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
  tagline: "Chunk, judge, aggregate — and say what chunking costs",
  thesis:
    "A document too long for the context cannot be stuffed into one call — it truncates, or the answer drowns. Sweeping it in overlapping windows judges each chunk against one question and aggregates the hits, finding a disclosure buried two-thirds of the way down. The honest catch, stated in the same view: a chunk is judged without the pages around it.",
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
