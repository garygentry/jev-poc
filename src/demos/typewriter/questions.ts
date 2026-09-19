import type { JevQuestionSet } from "@shared/jev.ts"

/**
 * Twelve judgements about a draft, re-answered on every pause in typing.
 *
 * Twelve questions cost roughly what one costs in wall-clock time, because they
 * share a state and are answered in parallel. That is what makes this shape
 * viable at all: a panel that re-reads your draft as you write it is only
 * possible when adding the twelfth question is close to free.
 *
 * None of these ask the model to rewrite anything, because it cannot. It can
 * only tell you what is true of what you wrote.
 */
export const QUESTIONS: JevQuestionSet = {
  tone: {
    type: "choice",
    instructions: "How this message will read to its recipient.",
    criteria: {
      warm: "Friendly and personable; acknowledges the reader.",
      neutral: "Plain and businesslike; neither warm nor cold.",
      curt: "Clipped and impatient; correct but unfriendly.",
      hostile: "Accusatory or aggressive toward the reader.",
    },
  },

  audience_fit: {
    type: "choice",
    instructions: "Who this message is pitched at, judging by how it is written.",
    criteria: {
      executive: "Assumes little context; leads with the decision or outcome.",
      peer: "Assumes shared context and vocabulary.",
      customer: "Explains internal matters in outside terms.",
      public: "Written for readers with no relationship to the sender.",
    },
  },

  clarity: {
    type: "score",
    instructions: "How easily a reader will understand what this message means.",
    criteria: [
      "The reader would have to ask what is meant.",
      "Understandable, but the reader must work for it.",
      "Plain on one reading.",
      "Plain on one reading, and the structure makes the key point unmissable.",
    ],
  },

  urgency: {
    type: "score",
    instructions: "How urgent this message presents itself as being.",
    criteria: [
      "No time pressure is implied.",
      "A timeframe is mentioned but nothing turns on it.",
      "The message asserts that something is needed immediately.",
    ],
  },

  hedging: {
    type: "score",
    instructions: "How much the message qualifies and softens its own claims.",
    criteria: [
      "States things directly.",
      "Occasional softeners that do not obscure the point.",
      "So qualified that the actual position is hard to locate.",
    ],
  },

  has_clear_ask: {
    type: "noul",
    instructions:
      "A reader would know what they are being asked to do after reading this once.",
  },

  has_deadline: {
    type: "noul",
    instructions: "The message states when a response or action is needed by.",
  },

  contains_pii: {
    type: "noul",
    instructions:
      "The message contains personal data: names with contact details, addresses, account or card numbers.",
  },

  contains_secret: {
    type: "noul",
    instructions:
      "The message contains a credential: an API key, token, password, or connection string.",
  },

  passive_aggressive: {
    type: "noul",
    instructions:
      "The message expresses irritation indirectly, through implication rather than statement.",
  },

  reads_as_complaint: {
    type: "noul",
    instructions:
      "A reader would take this primarily as a complaint rather than as a request or a report.",
  },

  ready_to_send: {
    type: "noul",
    instructions:
      "The message is finished: it makes its point, asks for what it needs, and contains no placeholders or unfinished sentences.",
  },
}

/** Ordered for display: the two Choices first, then Scores, then Nouls. */
export const DISPLAY_ORDER = Object.keys(QUESTIONS)
