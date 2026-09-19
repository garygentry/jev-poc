import type { JevQuestionSet } from "@shared/jev.ts"

/**
 * Four labels per row.
 *
 * All four ride in the same request per row, so labelling four things costs
 * about what labelling one would. With output tokens free, the marginal cost of
 * a richer schema is the handful of input tokens the extra question text adds —
 * which is what makes it reasonable to label everything rather than sampling.
 */
export const QUESTIONS: JevQuestionSet = {
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
}

/** Confidence below which a row goes to a human instead of being trusted. */
export const REVIEW_BELOW = 0.6
