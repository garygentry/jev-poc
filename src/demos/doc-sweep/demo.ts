import type { FanOutManifest } from "@/demos/_kit/types"

import { DOCUMENTS, TOPIC, chunksOf, stateFor, type Document } from "./document"

/**
 * One question, asked of every chunk of a document too long to read at once.
 *
 * The document is swept in overlapping windows — chunk, judge, aggregate — so
 * the cost never depends on the whole thing fitting in one context. A Noul,
 * because a passage supports the topic by degree, and a threshold turns the run
 * of chunk answers into a yes/no with the passages that back it.
 */
export const manifest: FanOutManifest<Document> = {
  slug: "doc-sweep",
  title: "Long-document sweep",
  tagline: "Judge overlapping document windows; aggregate passage-level hits",
  thesis:
    "The document is split into three-section windows with one-section overlap, and the same disclosure question is asked once per window. Code thresholds each probability at 0.6 and unions sections from hit windows, testing bounded-context screening while repeating overlap work and losing references outside each window.",
  group: "documents",
  order: 2,
  kind: "windowed",
  shape: {
    questions: "1",
    states: "one per chunk",
    requests: "fanned out, capped",
  },
  primitives: ["noul"],

  questions: {
    discloses: {
      type: "noul",
      instructions: `Judged only on this passage: does it state that ${TOPIC}?`,
      criteria: {
        true: "The passage says personal data or identifiers are shared with third parties for advertising, marketing, or profiling.",
        false:
          "The passage does not disclose sharing personal data with third parties for advertising or marketing.",
      },
    },
  },

  examples: DOCUMENTS.map((doc) => ({ id: doc.id, label: doc.label, input: doc })),

  itemsFor: (doc) =>
    chunksOf(doc).map((chunk) => ({ id: chunk.id, state: stateFor(chunk.paragraphs) })),

  estimateCalls: (doc) => chunksOf(doc).length,
}
