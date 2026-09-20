import type { Displacement, SingleManifest } from "@/demos/_kit/types"

export interface Ticket {
  subject: string
  body: string
  customer: { plan: string; tenure_months: number; prior_tickets: number }
}

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
export const manifest: SingleManifest<Ticket> = {
  slug: "triage",
  title: "Ticket triage",
  tagline: "Seven narrow questions beat one broad prompt",
  thesis:
    "Decomposition. Seven questions over one ticket cost roughly one question's wall-clock, and the routing policy stays in TypeScript where it can be read, tested and retuned without touching the model.",
  group: "foundations",
  order: 1,
  kind: "single",
  shape: { questions: "7", states: "1", requests: "1" },
  primitives: ["choice", "score", "noul"],

  /**
   * What triaging this ticket by chat model would cost instead — a stated
   * assumption, not a benchmark. The number is the per-ticket Haiku 4.5 spend
   * observed while planning this feature; it carries its source so a ratio can
   * never be read without it, and it will go stale as prices move.
   */
  displaces: {
    baseline: "one Haiku 4.5 call per ticket",
    unit: "request",
    baselineUsd: 0.000792,
    source:
      "Haiku 4.5 on OpenRouter ($1/$5 per M tokens); ~$0.000792/ticket observed 2026-09-19",
  } satisfies Displacement,

  questions: {
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
  },

  /**
   * Seeded tickets, chosen to exercise different branches of the policy rather
   * than to flatter it — including one the model should decline to call.
   */
  examples: [
    {
      id: "stripe-payouts",
      label: "Integration down, losing sales",
      input: {
        subject: "Stripe connection keeps failing",
        body: "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing with a 500 on the callback. We can't take payments and I'm losing sales every hour this is down. Please help ASAP.",
        customer: { plan: "growth", tenure_months: 14, prior_tickets: 2 },
      },
    },
    {
      id: "sso-question",
      label: "Calm pre-sales question",
      input: {
        subject: "Does Team include SSO?",
        body: "Quick question — does the Team plan include SSO, or is that Enterprise only? No rush, just planning our rollout for next quarter.",
        customer: { plan: "team", tenure_months: 3, prior_tickets: 0 },
      },
    },
    {
      id: "chargeback-threat",
      label: "Fourth contact, threatening chargeback",
      input: {
        subject: "cancel my account",
        body: "this is the fourth time i've written in. nobody reads these. cancel my account and refund the last two months or i'm filing a chargeback with my bank.",
        customer: { plan: "starter", tenure_months: 8, prior_tickets: 3 },
      },
    },
    {
      id: "ambiguous",
      label: "Genuinely ambiguous — watch the gates",
      input: {
        subject: "invoice looks wrong after the API change",
        body: "Since you changed the metering API our invoice doubled. Either the new endpoint is double-counting events or we're being billed for something we didn't sign up for. Can someone look?",
        customer: { plan: "growth", tenure_months: 22, prior_tickets: 1 },
      },
    },
  ],

  /** The literal state posted to Jev. Structured, not flattened to a string. */
  stateFor: (ticket) => ({
    ticket: { subject: ticket.subject, body: ticket.body },
    customer: ticket.customer,
  }),

  estimateCalls: () => 1,
}
