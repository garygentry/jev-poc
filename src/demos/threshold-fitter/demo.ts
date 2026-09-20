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
  tagline: "Fit the number every other demo guesses — for free, from recorded answers",
  thesis:
    "Every threshold in this tour is set by hand and defended in a comment. Here is the honest way to set one: sweep it against recorded answers with known labels and read off the value that best separates them. No model is called — the answers already exist — so fitting costs nothing, and it turns a guess into a measurement.",
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
