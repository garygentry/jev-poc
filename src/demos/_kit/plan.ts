/**
 * The one place a demo's upstream calls are planned, for the scripts that drive
 * every demo at once.
 *
 * `scripts/capture.ts` records Jev; `scripts/capture-baseline.ts` records the
 * chat-model baseline against the *same* states. Both need to know, per demo,
 * which calls a run makes — and for a `rounds` demo that is not a flat list: the
 * questions asked at depth 2 depend on what came back at depth 1. If the two
 * scripts planned that walk independently they could drift, and a baseline
 * recorded against a different tree than Jev's would compare nothing to nothing.
 * So the plan lives here once and both import it.
 *
 * Kept JSX-free and React-free for the same reason `types.ts` is: these run
 * under Node with no bundler.
 */
import { entryKey, roundEntry } from "./fixtures"
import type { AnyDemoManifest, RoundsManifest } from "./types"

import type { JevAnswer, JevQuestionSet, JevState } from "@shared/jev.ts"

/** One upstream call a demo needs: a state and the questions asked against it. */
export interface PlannedJob {
  key: string
  state: JevState
  questions: JevQuestionSet
}

/**
 * Every call a demo needs, for the demos whose plan is known up front.
 *
 * Returns an empty list for `rounds` (walked, not listed — see `walkRounds`) and
 * `offline` (no calls at all), so a caller can hand any manifest here and only
 * special-case the walk.
 */
export function flatJobs(manifest: AnyDemoManifest): PlannedJob[] {
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

    default:
      return []
  }
}

/**
 * Walk a `rounds` demo with the manifest's own plan.
 *
 * `visit` is called once per node with the state and the questions that node
 * asks, and must return the **Jev** answers for it — because the beam is Jev's,
 * and `advance` widens the next round from what Jev decided, not from what a
 * baseline guessed. The capture script gets those answers by asking Jev live;
 * the baseline script reads them from the committed Jev fixture and asks the
 * baseline the same questions on the side. Either way the tree they descend is
 * identical, which is the whole point of planning it in one place.
 */
export async function walkRounds(
  manifest: RoundsManifest<unknown, unknown, unknown>,
  visit: (
    node: PlannedJob & { depth: number },
  ) => Promise<Record<string, JevAnswer>>,
): Promise<void> {
  const { walk } = manifest

  for (const example of manifest.examples) {
    const state = manifest.stateFor(example.input)
    let carry = walk.initial

    for (let depth = 0; depth < walk.maxDepth; depth += 1) {
      const planned = walk.plan(depth, carry)
      if (!planned) break

      const key = roundEntry(example.id, depth)
      const answers = await visit({ key, state, questions: planned.questions, depth })
      carry = walk.advance(planned.round, answers, carry)
    }
  }
}
