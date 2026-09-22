import type { SingleManifest } from "@/demos/_kit/types"

import { FAILURES, stateFor, type Failure } from "./failures"

/**
 * What kind of failure this is, and whether it would fail again — two reads of
 * one CI output, in one request.
 *
 * The category is the classification; `deterministic` is the safety the auto-
 * retry gate turns on, and it is a *separate* read on purpose: a category can
 * come back "flaky" with real doubt, and the one thing an auto-retry must never
 * do is re-run something that will just fail the same way and bury a regression
 * under a green light. Both are pinned to the output text, not the test's name.
 */
export const manifest: SingleManifest<Failure> = {
  slug: "flaky-triage",
  title: "Flaky vs regression",
  tagline: "Classify a CI failure and constrain retry behavior in code",
  thesis:
    "One request returns a failure category with confidence and a probability that the failure will reproduce. Policy code auto-retries only a high-confidence flake that also scores as nondeterministic, blocks confident regressions, reruns infrastructure failures on a clean runner, and sends ambiguous cases to a human.",
  group: "engineering",
  order: 2,
  kind: "single",
  shape: { questions: "2", states: "1", requests: "1" },
  primitives: ["choice", "noul"],

  displaces: {
    baseline: "an engineer reading every CI failure to classify it",
    unit: "human-minute",
    baselineUsd: 1,
    source: "$90/hr loaded engineer rate, read 2026-09-20",
  },

  questions: {
    category: {
      type: "choice",
      instructions: "What kind of failure this CI output describes.",
      criteria: {
        flaky:
          "Nondeterministic — a timing race, an ordering dependency, a leaked global; it would likely pass on an identical re-run.",
        regression:
          "A real defect in the code under test — a wrong assertion, a new crash — that would fail again on a re-run.",
        infra:
          "The environment failed, not the test — an out-of-memory runner, a missing service, a network error reaching a dependency.",
        unclear: "The output does not say enough to tell these apart.",
      },
    },
    deterministic: {
      type: "noul",
      instructions:
        "Would an identical re-run of this test produce the same failure?",
      criteria: {
        true: "The failure is reproducible — the same code and inputs would fail the same way every time.",
        false:
          "The failure depends on timing, ordering, or the environment, so a re-run could just as easily pass.",
      },
    },
  },

  examples: FAILURES.map((failure) => ({
    id: failure.id,
    label: failure.label,
    input: failure,
  })),

  stateFor,

  estimateCalls: () => 1,
}
