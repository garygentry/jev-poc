export interface Case {
  id: string
  label: string
  text: string
  /** What a careful human would file it as, written before any run. */
  expected: string
}

export const CASES: Case[] = [
  {
    id: "webhook",
    label: "Webhook silence",
    text: "We stopped getting delivery callbacks around 14:00 yesterday. Our endpoint is up and returning 200 to our own health checks. Nothing in our logs at all from you since then.",
    expected: "technical › delivery › webhook_not_firing",
  },
  {
    id: "double-bill",
    label: "Invoice doubled",
    text: "Our invoice this month is exactly twice what it was last month and our usage has not changed. Can someone explain what the second line item is?",
    expected: "billing › invoices › invoice_line_items",
  },
  {
    id: "leaving",
    label: "Leaving, wants data",
    text: "We've decided to move to a different vendor at the end of the quarter. Before we do I need a complete copy of everything we've sent you over the last two years.",
    expected: "data › export › full_export",
  },
  {
    id: "ambiguous-billing",
    label: "Ambiguous inside billing",
    text: "Something's off with our account and money. I'm not sure if we were charged wrong or if we're on the wrong plan, but the numbers don't look right to me.",
    expected: "billing (the subtype is genuinely unclear)",
  },
  {
    id: "sso",
    label: "SSO rollout",
    text: "We're rolling out Okta across the company next month. What do we need to configure on your side, and does it work on our current plan?",
    expected: "account › access › sso_setup",
  },
]

export const stateFor = (item: Case) => ({ ticket: item.text })
