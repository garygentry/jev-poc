import type { JevQuestionSet } from "@shared/jev.ts"

import type { SingleManifest } from "@/demos/_kit/types"

export interface Request {
  text: string
}

/**
 * Incoming requests to a support agent, spread across how hard each is to
 * handle well — from a one-line balance question a small model settles in its
 * sleep, to a partial-refund dispute where a wrong call is expensive and hard
 * to notice after the fact.
 *
 * They are **self-contained**, for the same reason the router's prompts had to
 * be: the gate sees the request and only the request, so anything the judgement
 * depends on belongs in the text. `data-export` is the deliberate hard case —
 * it reads routine but carries real money and a deadline, which is exactly when
 * a cascade should decline to save the cent and route up.
 */
const REQUESTS = [
  {
    id: "balance",
    label: "Check a balance",
    text: "Hi — can you tell me what my current account balance is and when my next payment is due?",
  },
  {
    id: "reset",
    label: "Reset a password",
    text: "I'm locked out of my account and the password reset email never arrives. Can you help me get back in? My address is jo@example.com.",
  },
  {
    id: "double-charge",
    label: "Dispute a double charge",
    text: "I was charged twice for the same order (#48120) on the 3rd — two identical $79.00 lines. One needs refunding. The bank shows both as settled, not pending.",
  },
  {
    id: "data-export",
    label: "Refund a disputed annual plan",
    text: "We were auto-renewed on the annual plan on the 1st for $1,200 after I emailed on the 28th to cancel. I want the charge reversed in full. I have the cancellation email; your terms say cancellations take effect at period end, so this is contested.",
  },
  {
    id: "integration",
    label: "Debug a webhook integration",
    text: "Your webhooks stopped reaching our endpoint on Tuesday. We return 200s in under 300ms and nothing changed on our side; your dashboard shows them as 'delivered'. Where is the drop happening and what do you need from us to trace it?",
  },
]

/**
 * The gate Jev answers — cheap, and about the *request*, not the answer.
 *
 * Jev is not asked to handle the ticket. It is asked how hard handling it well
 * is going to be, so ordinary code can pick a model. Naming the tiers in the
 * question would bury the routing policy inside the model, where it could not be
 * tested or changed without re-running inference — the same discipline the
 * `router` demo holds to.
 */
export const manifest: SingleManifest<Request> = {
  slug: "cascade",
  title: "Cascade router",
  tagline: "Use a typed gate to choose the generative model tier",
  thesis:
    "One Jev call rates request difficulty and the probability that resolution requires an irreversible action. Policy code sends expert, high-stakes, or uncertain cases to Opus and the rest to Haiku; the comparison reports both paths' measured latency and cost.",
  group: "control-plane",
  order: 1,
  kind: "cascade",
  shape: { questions: "2", states: "1", requests: "1 gate + 1 worker" },
  primitives: ["choice", "noul"],

  questions: {
    difficulty: {
      type: "choice",
      instructions:
        "How much reasoning handling this request well actually takes.",
      criteria: {
        routine:
          "A direct request with one obvious way to satisfy it: a lookup, a status, a single well-defined action.",
        involved:
          "Needs a few facts held together or a short chain of steps, but no real judgement about a close call.",
        expert:
          "Turns on a contested or subtle judgement where being wrong is costly and would not be obvious at a glance.",
      },
    },

    high_stakes: {
      type: "noul",
      instructions:
        "Resolving this takes an irreversible or costly action, as opposed to reading something back.",
      /*
       * The first wording — "would move real money, be expensive to get wrong"
       * — read the broad way and fired on everything, including a plain balance
       * lookup, at 0.77. Live Jev was treating any billing context as stakes.
       *
       * The distinction the cascade actually needs is between *acting* and
       * *answering*: issuing a refund is irreversible and worth the frontier;
       * telling someone their balance is not, however much money the number is.
       * Pinning the criteria to the action rather than the topic is what makes
       * this noul discriminate instead of promoting every ticket.
       */
      criteria: {
        true: "Resolving it means taking an action that is hard to undo — issuing a refund, changing an account, making a commitment the company must honour.",
        false:
          "It is resolved by looking something up or explaining something; a wrong answer is fixed by simply answering again.",
      },
    },
  },

  examples: REQUESTS.map(({ id, label, text }) => ({ id, label, input: { text } })),

  stateFor: (request) => ({ request: request.text }),

  // One Jev gate call per run. The worker calls (chosen tier, and Opus for the
  // baseline) spend on a chat model and are never automatic, so they are not
  // counted here — this figure feeds the capture budget, which is Jev-only.
  estimateCalls: () => 1,
}

/**
 * The actual work, done by a chat model — never by Jev.
 *
 * This is the answer of record the support system would act on: which desk,
 * how urgent, and whether money moves. The whole demo is about *who* answers
 * it — the cheap tier or the frontier — so Jev stays out of it entirely and
 * only routes. Run through the same `/api/chat` harness the measured baseline
 * uses, so the cascade's numbers are measured on both tiers.
 */
export const TASK_QUESTIONS: JevQuestionSet = {
  department: {
    type: "choice",
    instructions: "Which desk should own this request.",
    criteria: {
      billing: "Charges, refunds, invoices, plan changes — anything about money.",
      technical: "Something is broken or not behaving: bugs, integrations, outages.",
      account: "Access, credentials, profile and account-state changes.",
      other: "None of the above, or it needs a human to decide where it goes.",
    },
  },
  urgency: {
    type: "score",
    instructions: "How quickly this needs a response.",
    criteria: [
      "Routine — a normal queue is fine.",
      "Time-sensitive — the customer is blocked or a deadline is near.",
      "Critical — money is moving the wrong way or a system is down for them now.",
    ],
  },
  needs_refund: {
    type: "noul",
    instructions:
      "Satisfying this request involves reversing or adjusting a charge.",
    criteria: {
      true: "A payment has to be refunded, credited or corrected to resolve it.",
      false: "No money moves to resolve it.",
    },
  },
}
