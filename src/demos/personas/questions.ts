import type { JevQuestionSet } from "@shared/jev.ts"

/**
 * Two questions, asked once per reader.
 *
 * The output you want here is not an argmax — it is the *spread*. Twelve
 * probabilities that all sit near 0.8 say something different from six near 0.95
 * and six near 0.1, and the mean is identical in both cases. Reading the
 * distribution across a population is the shape this demo exists to show.
 */
export const QUESTIONS: JevQuestionSet = {
  would_act: {
    type: "noul",
    instructions:
      "Given who `reader` is and what they care about, would this reader take the next step this `message` is asking for?",
    criteria: {
      true: "The message addresses something this particular reader is trying to achieve, in terms they would find credible.",
      false:
        "The message is fine in general but does not connect to this reader's priorities, or asks them to trust a claim they would discount.",
    },
  },

  lands: {
    type: "score",
    instructions: "How well the message lands with this specific reader.",
    criteria: [
      "Actively puts them off — wrong register, or triggers their scepticism.",
      "Bounces off; they would not finish reading it.",
      "Holds their attention but leaves their main question unanswered.",
      "Speaks directly to what they care about and answers it.",
    ],
  },
}
