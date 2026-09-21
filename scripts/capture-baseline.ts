/**
 * Record the chat-model baseline against the same states Jev saw.
 *
 *     pnpm capture:baseline                   # every demo, OpenRouter Haiku 4.5
 *     pnpm capture:baseline triage            # just one
 *     pnpm capture:baseline --backend cli     # via the local `claude` CLI instead
 *     pnpm capture:baseline --model anthropic/claude-sonnet-5
 *
 * Jev only exists on OpenRouter's decisions endpoint, so `pnpm capture` still
 * records Jev; this records the *other* column — an ordinary chat model asked
 * for the same structured answer, over the same states, keyed the same. The two
 * fixture sets (`fixtures/<slug>.json` and `fixtures/baseline/<slug>.json`) line
 * up 1:1 so `pnpm evidence` can compare them without guessing which row is which.
 *
 * Two backends, chosen with `--backend`:
 *   - `openrouter` (default) — the priced path the app itself uses, via `askChat`.
 *   - `cli` — the local `claude` binary, so a baseline can be captured with no
 *     OpenRouter key at all, on whatever model the CLI is signed in to run.
 *
 * The comparison is recorded as data, never as a score: each entry carries where
 * Jev and the baseline agreed and where they did not, and nothing here decides
 * which one was right. These fixtures have no ground truth.
 */
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { API_KEY, MODE } from "../server/config.ts"
import { mapWithConcurrency } from "../server/concurrency.ts"
import { askChat } from "../server/transport.ts"

import { loadManifests } from "../src/demos/_kit/load-manifests.ts"
import { flatJobs, walkRounds } from "../src/demos/_kit/plan.ts"
import type { AnyDemoManifest } from "../src/demos/_kit/types.ts"

import {
  BASELINE_MODEL,
  CHAT_PRICES,
  compareAll,
  parseBaseline,
  projectCost,
  promptFor,
  schemaFor,
} from "../shared/baseline.ts"
import type { BaselineAnswer, BaselinePrompt, Comparison } from "../shared/baseline.ts"
import type {
  JevAnswer,
  JevQuestionSet,
  JevState,
  JevUsage,
  SystemOneResponse,
} from "../shared/jev.ts"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(HERE, "../fixtures")
const BASELINE_DIR = path.join(FIXTURES, "baseline")

type Backend = "openrouter" | "cli"

/** The `claude` alias to run when nothing else is asked for on the CLI backend. */
const DEFAULT_CLI_MODEL = "claude-haiku-4-5-20251001"

/**
 * Above this the run asks first. Higher than capture's Jev ceiling because a
 * chat model's output tokens are the expensive half and are not free here.
 */
const CONFIRM_ABOVE_USD = 0.5

/** One recorded baseline call, aligned to a Jev fixture entry by its key. */
export interface BaselineEntry {
  model: string
  backend: Backend
  usage: JevUsage
  latencyMs: number
  /** Whether the raw reply parsed into the question set's shape on its own. */
  parseOk: boolean
  /** Present when parsing failed but the call itself succeeded. */
  parseError?: string
  /** Present when the call itself failed (network, CLI error, provider). */
  error?: string
  answers: Record<string, BaselineAnswer> | null
  raw: unknown
  /** Where this landed vs the committed Jev answer. Data, not a verdict. */
  comparisons: Comparison[]
}

/** Jev's raw response, plus the usage/latency the CLI reports around it. */
interface BaselineCall {
  raw: unknown
  usage: JevUsage
  latencyMs: number
  model: string
}

// ---------------------------------------------------------------------------
// Talking to a baseline model
// ---------------------------------------------------------------------------

/**
 * The CLI is not held to a JSON schema the way OpenRouter's structured-output
 * mode is, so the shape is spelled out per field in prose. Nouls especially need
 * this: without it a chat model reads a proposition as a boolean and answers
 * `true`/`false`, which is exactly the prose-to-struct slip the schema prevents
 * on the other backend.
 */
function jsonInstruction(questions: JevQuestionSet): string {
  const lines = Object.entries(questions)
    .map(([name, question]) => {
      if (question.type === "choice") {
        return `- "${name}": a string, exactly one of: ${Object.keys(question.criteria).join(", ")}`
      }
      if (question.type === "score") {
        return `- "${name}": an integer from 0 to ${question.criteria.length - 1}`
      }
      return `- "${name}": a number from 0 to 1 (a probability — never true/false)`
    })
    .join("\n")
  return (
    `Respond with ONLY a JSON object (no prose, no code fence) with exactly these keys ` +
    `and value types:\n${lines}`
  )
}

/** Pull a JSON object out of a CLI reply that may be fenced or wrapped in prose. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced?.[1] ?? text
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  return start === -1 || end < start ? body.trim() : body.slice(start, end + 1)
}

/** Run one headless `claude` turn and hand back its raw stdout and wall clock. */
function runClaude(model: string, prompt: string): Promise<{ stdout: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const child = spawn("claude", ["-p", prompt, "--model", model, "--output-format", "json"], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    let out = ""
    let err = ""
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0
        ? resolve({ stdout: out, latencyMs: Date.now() - started })
        : reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`)),
    )
  })
}

async function askBaseline(
  backend: Backend,
  model: string,
  state: JevState,
  questions: JevQuestionSet,
): Promise<BaselineCall> {
  const prompt: BaselinePrompt = promptFor(state, questions)

  if (backend === "openrouter") {
    const result = await askChat(model, prompt.system, prompt.user, schemaFor(questions))
    return { raw: result.content, usage: result.usage, latencyMs: result.latencyMs, model: result.model }
  }

  const full = `${prompt.system}\n\n${prompt.user}\n\n${jsonInstruction(questions)}`
  const { stdout, latencyMs } = await runClaude(model, full)
  const outer = JSON.parse(stdout) as {
    result?: unknown
    total_cost_usd?: number
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const resultText = typeof outer.result === "string" ? outer.result : JSON.stringify(outer.result)
  return {
    raw: JSON.parse(extractJson(resultText)),
    usage: {
      input_tokens: outer.usage?.input_tokens ?? 0,
      output_tokens: outer.usage?.output_tokens ?? 0,
      cost: outer.total_cost_usd ?? 0,
    },
    latencyMs,
    model,
  }
}

/** One call end to end: ask, parse, compare — every failure captured, not thrown. */
async function runOne(
  backend: Backend,
  model: string,
  state: JevState,
  questions: JevQuestionSet,
  jevAnswers: Record<string, JevAnswer>,
): Promise<BaselineEntry> {
  try {
    const call = await askBaseline(backend, model, state, questions)
    let answers: Record<string, BaselineAnswer> | null = null
    let parseError: string | undefined
    try {
      answers = parseBaseline(call.raw, questions)
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error)
    }
    return {
      model: call.model,
      backend,
      usage: call.usage,
      latencyMs: call.latencyMs,
      parseOk: answers !== null,
      ...(parseError ? { parseError } : {}),
      answers,
      raw: call.raw,
      comparisons: answers ? compareAll(questions, jevAnswers, answers) : [],
    }
  } catch (error) {
    return {
      model,
      backend,
      usage: { input_tokens: 0, output_tokens: 0, cost: 0 },
      latencyMs: 0,
      parseOk: false,
      error: error instanceof Error ? error.message : String(error),
      answers: null,
      raw: null,
      comparisons: [],
    }
  }
}

// ---------------------------------------------------------------------------
// Fixtures on disk
// ---------------------------------------------------------------------------

function readJevFixture(slug: string): Record<string, SystemOneResponse> {
  const file = path.join(FIXTURES, `${slug}.json`)
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, SystemOneResponse>
}

function writeBaseline(slug: string, out: Record<string, BaselineEntry>): void {
  mkdirSync(BASELINE_DIR, { recursive: true })
  writeFileSync(path.join(BASELINE_DIR, `${slug}.json`), JSON.stringify(out, null, 2) + "\n")
}

// ---------------------------------------------------------------------------
// Driving one demo
// ---------------------------------------------------------------------------

async function captureDemo(
  manifest: AnyDemoManifest,
  backend: Backend,
  model: string,
  concurrency: number,
): Promise<void> {
  const jev = readJevFixture(manifest.slug)
  const out: Record<string, BaselineEntry> = {}
  const answersAt = (key: string) => jev[key]?.answers ?? {}

  if (manifest.kind === "rounds") {
    process.stdout.write(`${manifest.slug.padEnd(14)} walking … `)
    await walkRounds(manifest, async ({ key, state, questions }) => {
      const jevAnswers = answersAt(key)
      out[key] = await runOne(backend, model, state, questions, jevAnswers)
      return jevAnswers
    })
  } else {
    const jobs = flatJobs(manifest)
    process.stdout.write(`${manifest.slug.padEnd(14)} ${jobs.length} calls … `)
    const settled = await mapWithConcurrency(jobs, concurrency, async (job) => ({
      key: job.key,
      entry: await runOne(backend, model, job.state, job.questions, answersAt(job.key)),
    }))
    for (const outcome of settled) {
      if ("value" in outcome) out[outcome.value.key] = outcome.value.entry
    }
  }

  writeBaseline(manifest.slug, out)

  const entries = Object.values(out)
  const failed = entries.filter((e) => e.error).length
  const unparsed = entries.filter((e) => !e.parseOk && !e.error).length
  const notes = [failed && `${failed} failed`, unparsed && `${unparsed} unparsed`].filter(Boolean)
  console.log(notes.length ? `ok (${notes.join(", ")})` : "ok")
}

// ---------------------------------------------------------------------------
// Cost projection and CLI preflight
// ---------------------------------------------------------------------------

/** Rough spend before a run, on the same 700-in/150-out blunt figures capture uses. */
function project(manifests: AnyDemoManifest[], model: string): { calls: number; usd: number } {
  const calls = manifests.reduce(
    (total, manifest) =>
      total +
      manifest.examples.reduce((sum, example) => sum + manifest.estimateCalls(example.input), 0),
    0,
  )
  const price = CHAT_PRICES[model] ?? CHAT_PRICES[BASELINE_MODEL]!
  const perCall = projectCost({ input_tokens: 700, output_tokens: 150, cost: 0 }, price)
  return { calls, usd: calls * perCall }
}

/** Fail fast with a clear message if the CLI backend has no `claude` to run. */
function ensureClaude(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["--version"], { stdio: "ignore" })
    child.on("error", () => resolve(false))
    child.on("close", (code) => resolve(code === 0))
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const positional: string[] = []
  let backend: Backend = "openrouter"
  let model: string | undefined
  let confirmed = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === "--yes") confirmed = true
    else if (arg === "--backend") backend = argv[(i += 1)] as Backend
    else if (arg.startsWith("--backend=")) backend = arg.slice("--backend=".length) as Backend
    else if (arg === "--model") model = argv[(i += 1)]
    else if (arg.startsWith("--model=")) model = arg.slice("--model=".length)
    else if (!arg.startsWith("--")) positional.push(arg)
  }

  if (backend !== "openrouter" && backend !== "cli") {
    console.error(`Unknown --backend "${backend}". Use "openrouter" or "cli".`)
    return 1
  }

  const chosenModel = model ?? (backend === "cli" ? DEFAULT_CLI_MODEL : BASELINE_MODEL)

  if (backend === "openrouter" && (MODE !== "live" || !API_KEY)) {
    console.error(
      "The openrouter backend needs OPENROUTER_API_KEY in .env.\n" +
        "Or run with --backend cli to use the local claude binary instead.",
    )
    return 1
  }
  if (backend === "cli" && !(await ensureClaude())) {
    console.error("Could not run `claude`. Is the CLI installed and on PATH?")
    return 1
  }

  const { manifests, missing } = await loadManifests(positional)
  if (missing.length > 0) {
    console.error(`Unknown demo(s): ${missing.join(", ")}`)
    return 1
  }

  // Only demos with a committed Jev side to compare against: skip the offline
  // demo and the synthetic wide fan-outs, exactly as `pnpm capture` does.
  const recordable = manifests.filter((m) => m.recorded !== false && m.kind !== "offline")

  const { calls, usd } = project(recordable, chosenModel)
  console.log(`Baseline via ${backend} · ${chosenModel}`)
  console.log(`${recordable.length} demos · ~${calls} calls · ~$${usd.toFixed(3)} projected\n`)

  if (usd > CONFIRM_ABOVE_USD && !confirmed) {
    console.error(`That is over $${CONFIRM_ABOVE_USD.toFixed(2)}. Re-run with --yes to go ahead.`)
    return 1
  }

  // The CLI spawns a whole process per call; keep it gentle. OpenRouter matches
  // the server's own fan-out ceiling.
  const concurrency = backend === "cli" ? 2 : 6

  for (const manifest of recordable) {
    try {
      await captureDemo(manifest, backend, chosenModel, concurrency)
    } catch (error) {
      console.log("failed")
      console.error(`  ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`\nBaseline recorded to fixtures/baseline/. Run \`pnpm evidence\` next.`)
  return 0
}

main().then((code) => process.exit(code))
