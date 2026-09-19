import type { JevQuestionSet } from "@shared/jev.ts"

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
export const QUESTIONS: JevQuestionSet = {
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
}
