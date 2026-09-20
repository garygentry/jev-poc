/**
 * Re-record every fixture against live Jev.
 *
 *     pnpm capture              # every demo that has fixtures
 *     pnpm capture triage       # just one
 *
 * Nothing about a demo is described here. Each `src/demos/<slug>/demo.ts`
 * declares its questions, its examples, its states and — for a walk — how one
 * round leads to the next, and this script drives whatever it finds. Adding a
 * demo therefore does not touch this file, which was the point of the kit: the
 * previous version named all eight and had grown a bespoke branch for the one
 * that could not be captured as a flat list.
 *
 * Costs real money, though not much: the full set is a few hundred calls at
 * $0.042 per million input tokens.
 */
import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { API_KEY, MODE, MODEL } from "../server/config.ts"
import { mapWithConcurrency } from "../server/concurrency.ts"
import { ProviderError, askJev } from "../server/transport.ts"

import { entryKey, roundEntry } from "../src/demos/_kit/fixtures.ts"
import { loadManifests } from "../src/demos/_kit/load-manifests.ts"
import type { AnyDemoManifest } from "../src/demos/_kit/types.ts"

import { projectJevSpend } from "../shared/jev.ts"
import type { JevQuestionSet, JevState } from "../shared/jev.ts"

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
)

/** Matches the server's own ceiling; capture is not a reason to hammer it. */
const CONCURRENCY = 6

/**
 * Above this, capture asks first.
 *
 * The projection is cheap to compute from `estimateCalls` and is most of the
 * reason that field exists, so a re-record that would cost real money cannot
 * start by accident.
 */
const CONFIRM_ABOVE_USD = 0.25

interface Job {
  key: string
  state: JevState
  questions: JevQuestionSet
}

type Recorded = Record<string, unknown>

const write = (demo: string, out: Recorded) =>
  writeFileSync(
    path.join(FIXTURES, `${demo}.json`),
    JSON.stringify(out, null, 2) + "\n",
  )

/** Every call a demo needs, for the demos whose plan is known up front. */
function jobsFor(manifest: AnyDemoManifest): Job[] {
  switch (manifest.kind) {
    case "fanout":
    case "pairwise":
    case "windowed":
      return manifest.examples.flatMap((example) =>
        manifest.itemsFor(example.input).map((item) => ({
          key: entryKey(example.id, item.id),
          state: item.state,
          questions: manifest.questions,
        })),
      )

    case "single":
    case "cascade":
      return manifest.examples.map((example) => ({
        key: entryKey(example.id),
        state: manifest.stateFor(example.input),
        questions: manifest.questions,
      }))

    // `rounds` is walked rather than listed; `offline` makes no calls at all.
    default:
      return []
  }
}

async function captureJobs(demo: string, jobs: Job[]): Promise<void> {
  process.stdout.write(`${demo.padEnd(12)} ${jobs.length} calls … `)

  const settled = await mapWithConcurrency(jobs, CONCURRENCY, async (job) => ({
    key: job.key,
    result: await askJev(job.state, job.questions),
  }))

  const out: Recorded = {}
  let failed = 0

  for (const outcome of settled) {
    if ("error" in outcome) {
      failed += 1
      continue
    }
    out[outcome.value.key] = outcome.value.result.raw
  }

  write(demo, out)
  console.log(
    failed === 0
      ? "ok"
      : `${Object.keys(out).length} recorded, ${failed} failed (kept the rest)`,
  )
}

/**
 * Walk a `rounds` demo with the manifest's own plan.
 *
 * It cannot be captured as a flat list: which questions get asked at depth 2
 * depends on what came back at depth 1. Using the manifest's `walk` is what
 * guarantees the recording matches the tree the UI will descend — the previous
 * version of this script reimplemented the beam here, and a change to either
 * one would silently have invalidated the other.
 */
async function captureWalk(
  manifest: Extract<AnyDemoManifest, { kind: "rounds" }>,
): Promise<void> {
  const { walk } = manifest
  process.stdout.write(
    `${manifest.slug.padEnd(12)} walking ${manifest.examples.length} cases … `,
  )

  const out: Recorded = {}

  for (const example of manifest.examples) {
    const state = manifest.stateFor(example.input)
    let carry = walk.initial

    for (let depth = 0; depth < walk.maxDepth; depth += 1) {
      const planned = walk.plan(depth, carry)
      if (!planned) break

      const call = await askJev(state, planned.questions)
      out[roundEntry(example.id, depth)] = call.raw
      carry = walk.advance(planned.round, call.response.answers, carry)
    }
  }

  write(manifest.slug, out)
  console.log(`ok (${Object.keys(out).length} rounds)`)
}

/** Calls and dollars this run would spend, before it spends any of them. */
function project(manifests: AnyDemoManifest[]): { calls: number; usd: number } {
  const calls = manifests.reduce(
    (total, manifest) =>
      total +
      manifest.examples.reduce(
        (sum: number, example) => sum + manifest.estimateCalls(example.input),
        0,
      ),
    0,
  )
  return { calls, usd: projectJevSpend(calls) }
}

async function main(): Promise<number> {
  if (MODE !== "live" || !API_KEY) {
    console.error(
      "No API key. Put OPENROUTER_API_KEY in .env before capturing —\n" +
        "there is nothing to record without one.",
    )
    return 1
  }

  const argv = process.argv.slice(2)
  const confirmed = argv.includes("--yes")
  const requested = argv.filter((arg) => !arg.startsWith("--"))

  const { manifests, missing } = await loadManifests(requested)
  if (missing.length > 0) {
    console.error(`Unknown demo(s): ${missing.join(", ")}`)
    return 1
  }

  // A demo with no committed fixtures replays a deterministic stand-in instead,
  // so there is nothing here to record for it.
  const recordable = manifests.filter(
    (manifest) => manifest.recorded !== false && manifest.kind !== "offline",
  )

  const { calls, usd } = project(recordable)
  console.log(`Capturing against ${MODEL}`)
  console.log(
    `${recordable.length} demos · ~${calls} calls · ~$${usd.toFixed(3)} projected\n`,
  )

  if (usd > CONFIRM_ABOVE_USD && !confirmed) {
    console.error(
      `That is over $${CONFIRM_ABOVE_USD.toFixed(2)}. Re-run with --yes to go ahead.`,
    )
    return 1
  }

  for (const manifest of recordable) {
    try {
      if (manifest.kind === "rounds") await captureWalk(manifest)
      else await captureJobs(manifest.slug, jobsFor(manifest))
    } catch (error) {
      // One demo failing should not discard the ones already written.
      console.log("failed")
      console.error(
        `  ${error instanceof ProviderError ? error.message : String(error)}`,
      )
    }
  }

  console.log("\nFixtures rewritten. They are recordings now, not seeds.")
  return 0
}

main().then((code) => process.exit(code))
