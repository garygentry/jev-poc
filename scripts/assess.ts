/**
 * Generate the Jev-vs-baseline assessment report by handing the evidence bundle
 * and the judge instructions to the `claude` CLI.
 *
 *     pnpm assess                                  # opus, default paths
 *     pnpm assess --model sonnet                   # cheaper judge
 *     pnpm assess --out docs/jev-assessment.md     # where the report lands
 *
 * Deliberately separate from data collection: this script computes nothing and
 * calls no model of its own. It reads `docs/assessment/INSTRUCTIONS.md` and
 * `docs/assessment/evidence.json` (from `pnpm evidence`), pipes both to a headless
 * `claude` turn, and writes whatever markdown comes back. The instructions are
 * what bind the judge to the evidence; the model here only narrates it.
 *
 * The evidence bundle is passed on stdin, not as an argument — a bundle can run
 * past the single-argument size limit, and stdin is the documented way to hand
 * `claude -p` a large body of context.
 */
import { spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..")
const DEFAULTS = {
  model: "opus",
  out: "docs/jev-assessment.md",
  evidence: "docs/assessment/evidence.json",
  instructions: "docs/assessment/INSTRUCTIONS.md",
}

const DIRECTIVE =
  "The piped content has two parts: assessment INSTRUCTIONS followed by an " +
  "EVIDENCE bundle. Follow the instructions exactly and reply with ONLY the " +
  "final Markdown report — no preamble, no code fence around the whole thing."

/** Run a headless `claude` turn with the body on stdin, returning its stdout. */
function runClaude(model: string, directive: string, stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", directive, "--model", model, "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let out = ""
    let err = ""
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`)),
    )
    child.stdin.write(stdin)
    child.stdin.end()
  })
}

function flag(argv: string[], name: string, fallback: string): string {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  if (i !== -1 && argv[i + 1] && !argv[i + 1]!.startsWith("--")) return argv[i + 1]!
  return fallback
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const model = flag(argv, "model", DEFAULTS.model)
  const out = flag(argv, "out", DEFAULTS.out)
  const evidencePath = path.resolve(ROOT, flag(argv, "evidence", DEFAULTS.evidence))
  const instructionsPath = path.resolve(ROOT, flag(argv, "instructions", DEFAULTS.instructions))

  for (const [label, file] of [
    ["instructions", instructionsPath],
    ["evidence", evidencePath],
  ] as const) {
    if (!existsSync(file)) {
      console.error(
        `Missing ${label} at ${path.relative(ROOT, file)}.` +
          (label === "evidence" ? " Run `pnpm evidence` first." : ""),
      )
      return 1
    }
  }

  const instructions = readFileSync(instructionsPath, "utf8")
  const evidence = readFileSync(evidencePath, "utf8")
  const body = `${instructions}\n\n--- EVIDENCE BUNDLE (the only source you may cite) ---\n\n\`\`\`json\n${evidence}\n\`\`\`\n`

  console.log(`Assessing with ${model} … (this calls the claude CLI and may take a minute)`)
  const report = await runClaude(model, DIRECTIVE, body)
  if (!report.trim()) {
    console.error("The model returned an empty report.")
    return 1
  }

  const outPath = path.resolve(ROOT, out)
  writeFileSync(outPath, report.trimEnd() + "\n")
  console.log(`Report written to ${path.relative(ROOT, outPath)} (${report.length} chars).`)
  return 0
}

main().then((code) => process.exit(code))
