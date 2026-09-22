import type { FanOutManifest } from "@/demos/_kit/types"

import { STORMS, pairsOf, type Storm } from "./alerts"

/**
 * One question per pair of alerts: are these the same incident?
 *
 * A Noul, because "same incident" is a judgement held by degree — two alerts can
 * be obviously one event, obviously separate, or a genuine maybe — and a
 * threshold turns the degree into the edge a cluster is built from. It is pinned
 * to the *underlying event*, not the wording, which is the whole difference from
 * a template rule: a shared metric shape is not a shared incident, and two
 * unlike messages can still be one.
 */
export const manifest: FanOutManifest<Storm> = {
  slug: "alert-dedup",
  title: "Alert dedup",
  tagline: "Compare every alert pair, then cluster accepted incident edges",
  thesis:
    "For n alerts, the demo makes n(n−1)/2 separate pairwise requests and receives a same-incident probability for each. Edges scoring at least 0.6 become connected components and are compared with template grouping, exposing both semantic matching and the quadratic request growth and transitive merges it introduces.",
  group: "engineering",
  order: 3,
  kind: "pairwise",
  shape: {
    questions: "1",
    states: "one per pair",
    requests: "fanned out, capped",
  },
  primitives: ["noul"],

  questions: {
    same_incident: {
      type: "noul",
      instructions:
        "Do these two alerts describe the same underlying incident — one root event showing up twice — rather than two separate problems?",
      criteria: {
        true: "They stem from one event: the same root cause, or one alert is a downstream symptom of the other.",
        false:
          "They are separate problems, even if they share a metric, a service family, or a phrasing — a coincidence of shape is not one incident.",
      },
    },
  },

  examples: STORMS.map((storm) => ({
    id: storm.id,
    label: storm.label,
    input: storm,
  })),

  itemsFor: (storm) => pairsOf(storm),

  estimateCalls: (storm) => pairsOf(storm).length,
}
