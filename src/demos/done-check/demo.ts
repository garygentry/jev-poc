import type { SingleManifest } from "@/demos/_kit/types"

import { TASKS, stateFor, type Task } from "./evidence"

/**
 * One noul per acceptance criterion, all against the same evidence, all in one
 * request. That they share a state is exactly why they batch: checking whether
 * the tests pass and whether the requirement is met are two questions about the
 * *same* diff, so they ride in a single call rather than five.
 *
 * Every criterion is phrased as a proposition about the **evidence**, not about
 * the agent's confidence — "the diff shows a test that exercises this", not "is
 * this well tested". A vague quality noul fires near 1.0 on anything that reads
 * competent; a noul pinned to a fact the diff either shows or does not is what
 * makes a false "done" break exactly one cell. `true`/`false` criteria spell the
 * boundary out so a stub cannot pass as an implementation on tone alone.
 */
export const manifest: SingleManifest<Task> = {
  slug: "done-check",
  title: "Done-check",
  tagline: "Check task evidence against five completion criteria in one request",
  thesis:
    "One request evaluates the task, diff, and test run for completeness, real implementation, coverage, passing tests, and scope. Policy code marks the task done only when every condition reaches 0.6 and otherwise lists the blockers, favoring recheck over accepting uncertain work.",
  group: "control-plane",
  order: 3,
  kind: "single",
  shape: { questions: "5", states: "1", requests: "1" },
  primitives: ["noul"],

  /**
   * A human re-checking a finished task against its acceptance criteria, priced
   * as a stated wage. It is an assumption, not a measurement — a rate read on a
   * date — so it is only ever the projected side of the comparison; the measured
   * side is Jev against a chat model, both from real usage.
   */
  displaces: {
    baseline: "a reviewer re-checking each criterion by hand",
    unit: "human-minute",
    baselineUsd: 1.5,
    source: "$90/hr loaded engineer rate, read 2026-09-20",
  },

  questions: {
    meets_requirement: {
      type: "noul",
      instructions:
        "Judged only against the evidence: does the change do everything the task asked for, or only part of it?",
      criteria: {
        true: "The diff implements the full requirement — every distinct thing the task asked for is present in the change.",
        false:
          "The change addresses only some of what was asked, or does something adjacent to it; a named part of the requirement is missing from the diff.",
      },
    },
    real_implementation: {
      type: "noul",
      instructions:
        "Is the logic actually written, or is it a placeholder standing in for it?",
      criteria: {
        true: "The body does the work: it computes or acts on the real inputs, not a fixed stand-in value.",
        false:
          "The body is a stub, TODO, or hardcoded/placeholder return that has the right shape but does not do the work.",
      },
    },
    has_test: {
      type: "noul",
      instructions:
        "Does the evidence include a test that exercises the new behaviour specifically — not merely that some suite exists?",
      criteria: {
        true: "A test in the diff covers the change: it drives the new code path and asserts on its result.",
        false:
          "No test touches the new behaviour — none was added, or the suite that ran does not exercise this change.",
      },
    },
    tests_pass: {
      type: "noul",
      instructions:
        "Does the reported test run show every test passing, with none failing or erroring?",
      criteria: {
        true: "The run in the evidence is fully green — zero failed, zero errored.",
        false:
          "The run shows at least one failing or erroring test, or no run is shown at all.",
      },
    },
    scoped: {
      type: "noul",
      instructions:
        "Is the change confined to the task, or did it also remove or disable unrelated behaviour to get there?",
      criteria: {
        true: "The diff touches only what the task needs; nothing unrelated is deleted, disabled, or weakened.",
        false:
          "The change also removes or disables something unrelated — an existing test, a guard, a check — rather than only adding what was asked.",
      },
    },
  },

  examples: TASKS.map(({ id, label, ...rest }) => ({
    id,
    label,
    input: { id, label, ...rest },
  })),

  stateFor,

  // One gate call per run: five criteria, one shared state, one request.
  estimateCalls: () => 1,
}
