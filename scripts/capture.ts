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

import { loadManifests } from "../src/demos/_kit/load-manifests.ts"
import { flatJobs, walkRounds } from "../src/demos/_kit/plan.ts"
import type { PlannedJob } from "../src/demos/_kit/plan.ts"
import type { AnyDemoManifest } from "../src/demos/_kit/types.ts"

import { projectJevSpend } from "../shared/jev.ts"

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

type Recorded = Record<string, unknown>

const write = (demo: string, out: Recorded) =>
  writeFileSync(
    path.join(FIXTURES, `${demo}.json`),
    JSON.stringify(out, null, 2) + "\n",
  )

async function captureJobs(demo: string, jobs: PlannedJob[]): Promise<void> {
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
 * Walk a `rounds` demo with the manifest's own plan (see `walkRounds`).
 *
 * The walk itself lives in the kit so the baseline script descends the same
 * tree; here it just asks Jev at each node, records the raw response, and hands
 * those answers back so the beam advances on what Jev actually decided.
 */
async function captureWalk(
  manifest: Extract<AnyDemoManifest, { kind: "rounds" }>,
): Promise<void> {
  process.stdout.write(
    `${manifest.slug.padEnd(12)} walking ${manifest.examples.length} cases … `,
  )

  const out: Recorded = {}

  await walkRounds(manifest, async ({ key, state, questions }) => {
    const call = await askJev(state, questions)
    out[key] = call.raw
    return call.response.answers
  })

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
      else await captureJobs(manifest.slug, flatJobs(manifest))
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
