export interface Ticket {
  id: string
  label: string
  subject: string
  body: string
  customer: { plan: string; tenure_months: number; prior_tickets: number }
}

/**
 * Seeded tickets, chosen to exercise different branches of the policy rather
 * than to flatter it — including one the model should decline to call.
 */
export const TICKETS: Ticket[] = [
  {
    id: "stripe-payouts",
    label: "Integration down, losing sales",
    subject: "Stripe connection keeps failing",
    body: "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing with a 500 on the callback. We can't take payments and I'm losing sales every hour this is down. Please help ASAP.",
    customer: { plan: "growth", tenure_months: 14, prior_tickets: 2 },
  },
  {
    id: "sso-question",
    label: "Calm pre-sales question",
    subject: "Does Team include SSO?",
    body: "Quick question — does the Team plan include SSO, or is that Enterprise only? No rush, just planning our rollout for next quarter.",
    customer: { plan: "team", tenure_months: 3, prior_tickets: 0 },
  },
  {
    id: "chargeback-threat",
    label: "Fourth contact, threatening chargeback",
    subject: "cancel my account",
    body: "this is the fourth time i've written in. nobody reads these. cancel my account and refund the last two months or i'm filing a chargeback with my bank.",
    customer: { plan: "starter", tenure_months: 8, prior_tickets: 3 },
  },
  {
    id: "ambiguous",
    label: "Genuinely ambiguous — watch the gates",
    subject: "invoice looks wrong after the API change",
    body: "Since you changed the metering API our invoice doubled. Either the new endpoint is double-counting events or we're being billed for something we didn't sign up for. Can someone look?",
    customer: { plan: "growth", tenure_months: 22, prior_tickets: 1 },
  },
]

/** The literal state posted to Jev. Structured, not flattened to a string. */
export const stateFor = (ticket: Ticket) => ({
  ticket: { subject: ticket.subject, body: ticket.body },
  customer: ticket.customer,
})
