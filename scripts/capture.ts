/**
 * Re-record every seeded fixture against live Jev.
 *
 * The fixtures committed to this repo are **hand-written**. They are plausible
 * and they are shaped exactly like real responses, but nobody has ever received
 * them from the model — which is why the UI badges them rather than presenting
 * them as recordings. Running this with a key in `.env` replaces them with
 * responses the model actually gave, and the badge stops being a caveat.
 *
 *     pnpm capture              # every demo
 *     pnpm capture triage       # just one
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

import { QUESTIONS as TRIAGE_Q } from "../src/demos/triage/questions.ts"
import { TICKETS, stateFor as triageState } from "../src/demos/triage/examples.ts"
import { QUESTIONS as GUARD_Q } from "../src/demos/guardrail/questions.ts"
import { COMMANDS, stateFor as guardState } from "../src/demos/guardrail/examples.ts"
import { QUESTIONS as RERANK_Q } from "../src/demos/rerank/questions.ts"
import { PASSAGES, QUERIES, stateFor as rerankState } from "../src/demos/rerank/corpus.ts"
import { QUESTIONS as TYPE_Q } from "../src/demos/typewriter/questions.ts"
import { DRAFTS } from "../src/demos/typewriter/examples.ts"
import { QUESTIONS as ROUTER_Q } from "../src/demos/router/questions.ts"
import { PROMPTS, stateFor as routerState } from "../src/demos/router/examples.ts"
import { PERSONAS, stateFor as personaState } from "../src/demos/personas/personas.ts"
import { DRAFTS as PERSONA_DRAFTS } from "../src/demos/personas/examples.ts"
import { QUESTIONS as PERSONA_Q } from "../src/demos/personas/questions.ts"
import { CASES, stateFor as taxonomyState } from "../src/demos/taxonomy/examples.ts"
import { alive, expand, planRound, type Branch } from "../src/demos/taxonomy/beam.ts"

import type { ChoiceAnswer, JevQuestionSet, JevState } from "../shared/jev.ts"

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
)

/** Matches the server's own ceiling; capture is not a reason to hammer it. */
const CONCURRENCY = 6

interface Job {
  key: string
  state: JevState
  questions: JevQuestionSet
}

type Recorded = Record<string, unknown>

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

  writeFileSync(
    path.join(FIXTURES, `${demo}.json`),
    JSON.stringify(out, null, 2) + "\n",
  )
  console.log(
    failed === 0
      ? "ok"
      : `${Object.keys(out).length} recorded, ${failed} failed (kept the rest)`,
  )
}

/**
 * The taxonomy demo cannot be captured as a flat list: which questions get
 * asked at level 2 depends on what came back at level 1, so each case has to be
 * walked with the same beam logic the UI uses.
 */
async function captureTaxonomy(): Promise<void> {
  process.stdout.write(`taxonomy     walking ${CASES.length} cases … `)
  const out: Recorded = {}

  for (const item of CASES) {
    const state = taxonomyState(item)
    let branches: Branch[] = [{ path: [], probability: 1, confidence: 1 }]

    for (let depth = 0; depth < 3; depth += 1) {
      const round = planRound(depth, alive(branches))
      if (!round) break

      const call = await askJev(state, round.questions)
      out[`${item.id}-d${depth}`] = call.raw

      const choices: Record<string, ChoiceAnswer> = {}
      for (const [name, answer] of Object.entries(call.response.answers)) {
        if (answer.type === "choice") choices[name] = answer
      }

      const stopped = branches.filter((branch) => branch.stoppedBecause)
      branches = [...expand(round, choices), ...stopped]
    }
  }

  writeFileSync(
    path.join(FIXTURES, "taxonomy.json"),
    JSON.stringify(out, null, 2) + "\n",
  )
  console.log(`ok (${Object.keys(out).length} rounds)`)
}

const CAPTURES: Record<string, () => Promise<void>> = {
  triage: () =>
    captureJobs(
      "triage",
      TICKETS.map((ticket) => ({
        key: ticket.id,
        state: triageState(ticket),
        questions: TRIAGE_Q,
      })),
    ),

  guardrail: () =>
    captureJobs(
      "guardrail",
      COMMANDS.map((command) => ({
        key: command.id,
        state: guardState(command),
        questions: GUARD_Q,
      })),
    ),

  typewriter: () =>
    captureJobs(
      "typewriter",
      DRAFTS.map((draft) => ({
        key: draft.id,
        state: { draft: draft.text },
        questions: TYPE_Q,
      })),
    ),

  router: () =>
    captureJobs(
      "router",
      PROMPTS.map((prompt) => ({
        key: prompt.id,
        state: routerState(prompt),
        questions: ROUTER_Q,
      })),
    ),

  rerank: () =>
    captureJobs(
      "rerank",
      QUERIES.flatMap((query) =>
        PASSAGES.map((passage) => ({
          key: `${query.id}/${passage.id}`,
          state: rerankState(query, passage),
          questions: RERANK_Q,
        })),
      ),
    ),

  personas: () =>
    captureJobs(
      "personas",
      PERSONA_DRAFTS.flatMap((draft) =>
        PERSONAS.map((persona) => ({
          key: `${draft.id}/${persona.id}`,
          state: personaState(persona, draft.text),
          questions: PERSONA_Q,
        })),
      ),
    ),

  taxonomy: captureTaxonomy,
}

async function main(): Promise<number> {
  if (MODE !== "live" || !API_KEY) {
    console.error(
      "No API key. Put OPENROUTER_API_KEY in .env before capturing —\n" +
        "there is nothing to record without one.",
    )
    return 1
  }

  const requested = process.argv.slice(2)
  const names = requested.length > 0 ? requested : Object.keys(CAPTURES)

  const unknown = names.filter((name) => !(name in CAPTURES))
  if (unknown.length > 0) {
    console.error(`Unknown demo(s): ${unknown.join(", ")}`)
    console.error(`Available: ${Object.keys(CAPTURES).join(", ")}`)
    return 1
  }

  console.log(`Capturing against ${MODEL}\n`)

  for (const name of names) {
    try {
      await CAPTURES[name]!()
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
