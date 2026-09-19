import type { JevQuestionSet } from "@shared/jev.ts"

/**
 * Seven narrow questions, answered against one ticket in one request.
 *
 * The decomposition is the point. A single "triage this ticket" prompt to a
 * chat model returns prose you have to parse and cannot trust; seven scoped
 * questions return calibrated numbers that ordinary code can branch on.
 *
 * Each primitive is picked by what its answer *means*, not by taste: one of a
 * fixed set is a Choice, a degree along a described dimension is a Score, and
 * whether a condition holds is a Noul.
 */
export const QUESTIONS: JevQuestionSet = {
  department: {
    type: "choice",
    instructions: "Which team should handle this ticket.",
    criteria: {
      billing:
        "Charges, refunds, invoices, subscription changes, cancellations.",
      technical:
        "Bugs, failed integrations, errors, anything that is not working.",
      sales:
        "Pricing, plan comparisons, capabilities of plans the customer does not have.",
      // A no-match option, because the model cannot choose a value it was
      // never offered — without this it must pick among wrong answers.
      other: "None of the above applies.",
    },
  },

  frustration: {
    type: "score",
    instructions: "How frustrated the customer sounds.",
    criteria: [
      "Neutral or friendly; stating facts or asking a question.",
      "Visibly annoyed but still civil.",
      "Angry; strong language, threats, or accusations.",
    ],
  },

  business_impact: {
    type: "score",
    instructions:
      "How much the customer's own business is being harmed right now.",
    criteria: [
      "No harm; a question or a preference.",
      "Inconvenience; a workaround exists.",
      "Active revenue or operational loss while this continues.",
    ],
  },

  is_urgent: {
    type: "noul",
    instructions: "The message conveys urgency or time-sensitivity.",
  },

  threatens_churn: {
    type: "noul",
    instructions:
      "The customer threatens to cancel, refund, charge back, or leave.",
  },

  refund_requested: {
    type: "noul",
    instructions: "The customer is asking for money back.",
  },

  is_repeat_contact: {
    type: "noul",
    instructions:
      "The customer says they have written in about this before without resolution.",
  },
}
