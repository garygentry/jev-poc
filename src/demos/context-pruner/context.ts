import type { JevState } from "@shared/jev.ts"

/** One block of retrieved context — a doc, a log, a prior message, a tool result. */
export interface Chunk {
  id: string
  /** A short human label for the row; not sent to the model. */
  label: string
  text: string
}

export interface Scenario {
  id: string
  label: string
  /** The task the context is being assembled for. Relevance is judged against it. */
  goal: string
  chunks: Chunk[]
}

/**
 * A rough token count: about four characters to a token.
 *
 * Deliberately blunt. The saving this demo reports is downstream tokens *not
 * sent*, and an order-of-magnitude-right count is enough to make the point
 * without implying a tokenizer-exact measurement the demo never ran.
 */
export const tokensOf = (text: string): number => Math.ceil(text.length / 4)

/**
 * What the gate judges: the goal, and one chunk, together.
 *
 * The goal rides in every item's state because relevance has no meaning without
 * it — the same paragraph is worth keeping for one task and noise for another.
 * That the goal repeats across items is exactly why these cannot batch: each
 * item is a *different* state.
 */
export const stateFor = (goal: string, chunk: Chunk): JevState => ({
  goal,
  chunk: chunk.text,
})

/**
 * Three assembled contexts, each mixing chunks that answer the goal with
 * distractors that merely share its vocabulary.
 *
 * The vocabulary-sharing distractors are the point: a keyword filter keeps them,
 * because it cannot tell "mentions checkout" from "explains the checkout
 * timeout". They are what a relevance judgement has to prune that a cheaper
 * filter cannot.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: "checkout-timeout",
    label: "Debug an EU checkout timeout",
    goal: "Find why the checkout request times out for EU users, and what to change.",
    chunks: [
      {
        id: "eu-latency-log",
        label: "EU latency log",
        text: "prod-eu-west-1: p99 for POST /checkout climbed from 400ms to 9.2s at 14:05 UTC. The spike tracks a synchronous call to the tax service, which is deployed only in us-east-1; every EU checkout now makes a cross-Atlantic round trip under the request.",
      },
      {
        id: "timeout-config",
        label: "Gateway timeout config",
        text: "The API gateway aborts any request still open after 8s and returns 504. /checkout holds the connection while it settles tax and inventory in series, so a single slow dependency pushes the whole request past the ceiling rather than degrading one part of it.",
      },
      {
        id: "tax-service-region",
        label: "Tax service regions",
        text: "The tax service runs in us-east-1 only. There has been a ticket open since March to add a eu-west-1 replica; it is unstaffed. Callers outside us-east pay the full cross-region latency on every call because nothing is cached.",
      },
      {
        id: "marketing-copy",
        label: "Marketing page copy",
        text: "Checkout in seconds. Our lightning-fast, frictionless checkout means your customers never wait — a smooth path from cart to confirmation that keeps conversion high and abandonment low across every market you sell in.",
      },
      {
        id: "old-changelog",
        label: "2023 changelog",
        text: "Release 4.1 (2023): redesigned the checkout button, added Apple Pay, and moved the promo-code field above the fold. Fixed a bug where the order summary double-counted shipping on multi-item carts. No changes to request handling or timeouts.",
      },
      {
        id: "unrelated-readme",
        label: "Analytics service README",
        text: "The analytics service ingests clickstream events over a message queue and rolls them up nightly. It is entirely asynchronous and is not on the checkout request path; nothing it does can affect checkout latency or a request timing out.",
      },
      {
        id: "inventory-note",
        label: "Inventory dependency note",
        text: "Checkout also calls the inventory service to confirm stock before charging. Inventory is deployed in every region and answers in under 30ms, so it is not a plausible source of a multi-second delay, but it does sit inside the same synchronous block.",
      },
      {
        id: "support-macro",
        label: "Support reply macro",
        text: "Hi! Sorry to hear checkout isn't working. Please try clearing your browser cache and cookies, then attempt the purchase again. If the problem continues, let us know your browser and country and we'll take another look.",
      },
    ],
  },
  {
    id: "enterprise-onboarding",
    label: "Onboard an enterprise customer",
    goal: "Draft the concrete steps to onboard a new enterprise customer with SSO.",
    chunks: [
      {
        id: "enterprise-checklist",
        label: "Enterprise onboarding checklist",
        text: "Enterprise onboarding: provision the org, invite the admin, configure SAML SSO against their IdP, set the default role mapping, enable audit-log export, and schedule a kickoff. Nothing is self-serve at this tier; a solutions engineer drives each step.",
      },
      {
        id: "sso-setup",
        label: "SAML SSO setup guide",
        text: "To configure SAML: exchange metadata with the customer's IdP, set the ACS URL and entity ID, map the email and groups claims, then test with a non-admin account before enforcing SSO-only sign-in for the org.",
      },
      {
        id: "role-mapping",
        label: "Role mapping reference",
        text: "Group claims from the IdP map to roles: 'admins' → owner, 'staff' → member, everything else → viewer. Unmapped groups get no access rather than a default, so a missing mapping fails closed and is caught at the test-login step.",
      },
      {
        id: "smb-selfserve",
        label: "SMB self-serve flow",
        text: "Small teams sign up with an email and password, add a card, and invite colleagues from the settings page. There is no SSO, no solutions engineer, and no contract — the whole flow is self-serve and takes about two minutes.",
      },
      {
        id: "billing-faq",
        label: "Billing FAQ",
        text: "We bill monthly or annually. Annual plans get two months free. You can change plans at any time; downgrades take effect at the end of the period. Failed payments retry for seven days before the account is suspended.",
      },
      {
        id: "blog-post",
        label: "Company blog post",
        text: "Why we rebuilt onboarding: last quarter we noticed new users dropping off before their first win, so we redesigned the welcome tour and cut the setup checklist in half. Early numbers show activation up and time-to-value down.",
      },
      {
        id: "security-whitepaper",
        label: "Security whitepaper excerpt",
        text: "All data is encrypted at rest and in transit. We support SSO via SAML and SCIM provisioning, maintain SOC 2 Type II, and offer per-org audit logs. Enterprise customers can request a DPA and a security review before signing.",
      },
    ],
  },
  {
    id: "payment-incident",
    label: "Write up the payment outage",
    goal: "Summarise the payment outage on the 3rd for the incident report.",
    chunks: [
      {
        id: "postmortem-draft",
        label: "Outage postmortem draft",
        text: "On the 3rd, 09:12–10:04 UTC, card charges failed with a 502 from the payments provider. Root cause: a rotated API key was deployed to the charge service but not to the refund worker, which then crash-looped and saturated the shared connection pool.",
      },
      {
        id: "alert-timeline",
        label: "Alert timeline",
        text: "09:12 first PagerDuty alert on charge error rate. 09:20 on-call acknowledges. 09:41 rollback of the key change started. 10:04 error rate back to baseline. 52 minutes of degraded charging; refunds were queued and processed after recovery.",
      },
      {
        id: "customer-impact",
        label: "Customer impact tally",
        text: "During the window, 1,840 charge attempts failed and were safely retried by the client with idempotency keys; no double charges resulted. Roughly 210 customers saw an error at checkout and completed on a second attempt after recovery.",
      },
      {
        id: "other-outage",
        label: "Unrelated search outage",
        text: "Separately, on the 7th, product search was slow for 20 minutes after a bad index deploy. Unrelated to payments and handled by a different team; noted here only because it landed in the same on-call week.",
      },
      {
        id: "deploy-notes",
        label: "Routine deploy notes",
        text: "Weekly deploy on the 2nd shipped a copy change to the pricing page and bumped three dependencies. No infrastructure or payment-path changes. Nothing in this deploy touched the charge or refund services.",
      },
      {
        id: "offsite-email",
        label: "Team offsite email",
        text: "Reminder: the team offsite is next Thursday. Please book your travel by Friday and add any dietary requirements to the sheet. We'll do a retro on the last quarter in the morning and planning in the afternoon.",
      },
    ],
  },
]
