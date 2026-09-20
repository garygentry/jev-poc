import type { FanOutManifest } from "@/demos/_kit/types"

import { DEFAULT_ROWS, MAX_ROWS, buildDataset } from "./dataset"

/** How many rows to label. The input here is a size, not a document. */
export interface Batch {
  rows: number
}

/** Confidence below which a row goes to a human instead of being trusted. */
export const REVIEW_BELOW = 0.6

/** Mirrors the server's own cap; the server clamps regardless. */
export const CONCURRENCY = 8

/**
 * Four labels per row.
 *
 * All four ride in the same request per row, so labelling four things costs
 * about what labelling one would. With output tokens free, the marginal cost of
 * a richer schema is the handful of input tokens the extra question text adds —
 * which is what makes it reasonable to label everything rather than sampling.
 */
export const manifest: FanOutManifest<Batch> = {
  slug: "bulk",
  title: "Bulk labelling",
  tagline: "Free output tokens change the arithmetic",
  thesis:
    "Classification at a price where you stop rationing it. The interesting output is not the labels but the low-confidence queue: the rows Jev declined to call, routed to a human.",
  group: "foundations",
  order: 7,
  kind: "fanout",
  shape: {
    questions: "4",
    states: `up to ${MAX_ROWS}`,
    requests: `${CONCURRENCY} at a time`,
  },
  primitives: ["choice", "score", "noul"],

  /**
   * Two hundred fixtures would be absurd, so this demo has none and replays the
   * deterministic stand-in instead — badged `synthetic` wherever it appears,
   * and withheld from every cost and timing readout.
   */
  recorded: false,

  questions: {
    sentiment: {
      type: "choice",
      instructions: "How the writer feels about the product in this message.",
      criteria: {
        negative: "Frustrated, disappointed, or complaining.",
        neutral: "Asking or reporting without evident feeling either way.",
        positive: "Pleased, appreciative, or complimentary.",
        mixed: "Clearly both — praises one thing and criticises another.",
      },
    },

    theme: {
      type: "choice",
      instructions: "What part of the product this message is about.",
      criteria: {
        reliability: "Things failing, timing out, or losing data.",
        usability: "The product working as built but being awkward to use.",
        capability: "Something the product does not do at all.",
        performance: "Speed, latency, or responsiveness.",
        other: "None of the above applies.",
      },
    },

    severity: {
      type: "score",
      instructions: "How badly this is affecting the person writing.",
      criteria: [
        "Not affecting them; an observation or a compliment.",
        "Mildly annoying; they work around it.",
        "Blocking real work, or costing them money.",
      ],
    },

    is_actionable: {
      type: "noul",
      instructions:
        "This message contains enough specific detail for someone to act on it without replying to ask for more.",
    },
  },

  /** Batch sizes rather than contents — the size is what the demo varies. */
  startAt: String(DEFAULT_ROWS),
  examples: [20, DEFAULT_ROWS, 120, MAX_ROWS].map((rows) => ({
    id: String(rows),
    label: String(rows),
    input: { rows },
  })),

  itemsFor: ({ rows }) =>
    buildDataset(rows).map((row) => ({
      id: row.id,
      state: { feedback: row.text },
    })),

  estimateCalls: ({ rows }) => rows,
}
