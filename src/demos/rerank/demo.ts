import type { FanOutManifest } from "@/demos/_kit/types"

import { PASSAGES, QUERIES, stateFor, type Query } from "./corpus"

/**
 * One question, asked once per candidate passage.
 *
 * A Noul rather than a Score, because there is no rubric to place a candidate
 * on — either the article answers the question or it does not — and a
 * probability sorts directly.
 *
 * Explicit true/false criteria matter more here than usual. The failure mode of
 * retrieval is a passage that shares vocabulary with the question without
 * answering it, so the `false` description names that case specifically.
 */
export const manifest: FanOutManifest<Query> = {
  slug: "rerank",
  title: "Semantic re-rank",
  tagline: "One relevance probability per candidate passage",
  thesis:
    "Each query–passage pair is separate state, so one relevance question fans out as a concurrent request per candidate. The returned probabilities become sort and filter inputs in ordinary code and are compared with a word-overlap baseline.",
  group: "foundations",
  order: 3,
  kind: "fanout",
  shape: { questions: "1", states: String(PASSAGES.length), requests: `${PASSAGES.length} concurrent` },
  primitives: ["noul"],

  questions: {
    relevant: {
      type: "noul",
      instructions:
        "The customer asked `question` and the support article in `article` was retrieved. Does the article actually answer what the customer asked?",
      criteria: {
        true: "The article resolves the customer's situation, including when it does so by explaining why the thing they want is unavailable to them.",
        false:
          "The article is on a related topic, or shares vocabulary with the question, but does not tell the customer what to do about their situation.",
      },
    },
  },

  examples: QUERIES.map((query) => ({
    id: query.id,
    label: `${query.id} · ${query.text.slice(0, 34)}…`,
    input: query,
  })),

  /** One passage is one state — which is exactly why this cannot batch. */
  itemsFor: (query) =>
    PASSAGES.map((passage) => ({
      id: passage.id,
      state: stateFor(query, passage),
    })),

  estimateCalls: () => PASSAGES.length,
}
