import type { OfflineManifest } from "@/demos/_kit/types"

import { SAMPLES, type Sample } from "./data"

/**
 * The one demo that makes no calls at all.
 *
 * Every other demo in the tour hard-codes a threshold and justifies it in a
 * comment. This one derives it: it reads a set of answers already recorded,
 * labelled by hand, and sweeps every threshold against them to find the one that
 * actually separates the classes. It is the offline shape — zero requests — and
 * it is sequenced last because, given the other demos' fixtures and a few
 * labels, it is how their numbers should have been chosen all along.
 */
export const manifest: OfflineManifest<Sample[]> = {
  slug: "threshold-fitter",
  title: "Threshold fitter",
  tagline: "Fit a decision cutoff from labelled, recorded Jev answers",
  thesis:
    "Recorded relevance probabilities are paired with human labels; code evaluates cutoffs from 0 to 1 in 0.05 steps and selects the F1 maximum, with lower cutoffs winning ties. The result drives deterministic keep/drop decisions and confusion metrics without a model call, but depends on representative labels.",
  group: "method",
  order: 1,
  kind: "offline",
  shape: {
    questions: "0",
    states: "recorded",
    requests: "0 — reads answers already recorded",
  },
  primitives: ["noul"],

  questions: {},

  examples: [
    { id: "relevance", label: "Recorded relevance answers", input: SAMPLES },
  ],

  // The offline shape: nothing is ever sent, so a run costs nothing.
  estimateCalls: () => 0,
}
