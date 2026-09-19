/**
 * A help centre for a fictional event-ingestion product, plus six customer
 * questions.
 *
 * On provenance, because it decides what the comparison is worth: the passages
 * were written first, as documentation. The queries were written afterwards but
 * *before* either ranker was run, deliberately in a customer's words rather
 * than the documentation's — which is what makes several of them hard for word
 * matching. Neither set has been edited since, and in particular no passage was
 * adjusted after seeing a result.
 *
 * That is a real retrieval difficulty rather than a manufactured one, but it is
 * still a choice, and six queries is a demonstration and not a benchmark.
 */

export interface Passage {
  id: string
  title: string
  body: string
}

export const PASSAGES: Passage[] = [
  {
    id: "p01",
    title: "Creating your first project",
    body: "A project groups events, dashboards and API keys. Create one from Settings → Projects. Every event you send must name a project, and projects cannot be merged after creation.",
  },
  {
    id: "p02",
    title: "Inviting teammates",
    body: "Owners and admins can invite teammates from Settings → Members. Invitations expire after seven days. Seat count affects billing on metered plans.",
  },
  {
    id: "p03",
    title: "Roles and permissions",
    body: "There are four roles: owner, admin, member and read-only. Only owners can change billing details or delete a project. Admins can rotate API keys.",
  },
  {
    id: "p04",
    title: "Generating an API key",
    body: "Create keys from Settings → API keys. A key is shown once at creation and cannot be retrieved afterwards. Keys are scoped to a single project.",
  },
  {
    id: "p05",
    title: "Rotating a leaked API key",
    body: "If a key has been exposed, revoke it immediately from Settings → API keys. Create a replacement first and deploy it, then revoke the old key to avoid dropped events during the swap.",
  },
  {
    id: "p06",
    title: "Sending your first event",
    body: "POST to /v1/events with your project key in the Authorization header. The body needs a name and a timestamp; everything else is treated as a property.",
  },
  {
    id: "p07",
    title: "Batching events",
    body: "Send up to 500 events in one request by posting an array. Batches are accepted atomically: if one event is malformed the whole batch is rejected with the offending index.",
  },
  {
    id: "p08",
    title: "Event property limits",
    body: "An event may carry up to 200 properties. Property names are capped at 64 characters and values at 8KB. Anything longer is truncated rather than rejected.",
  },
  {
    id: "p09",
    title: "Rate limits",
    body: "Ingestion is limited to 10,000 events per second per project. Exceeding it returns 429 with a Retry-After header. Limits can be raised on request.",
  },
  {
    id: "p10",
    title: "Idempotency and duplicate events",
    body: "Supply an idempotency_key on each event and we will discard repeats for 24 hours. Without one, a retried request creates a second event.",
  },
  {
    id: "p11",
    title: "Timestamps and time zones",
    body: "Timestamps must be ISO 8601 with an offset. Events are stored in UTC and rendered in the viewer's time zone. Events dated more than 30 days in the past are accepted but excluded from real-time dashboards.",
  },
  {
    id: "p12",
    title: "Building a dashboard",
    body: "Dashboards are made of tiles, each backed by a saved query. Tiles refresh on the interval you choose, down to one minute.",
  },
  {
    id: "p13",
    title: "Saved queries",
    body: "Any exploration can be saved and reused as a tile or an alert. Saved queries are shared with the whole project by default.",
  },
  {
    id: "p14",
    title: "Setting up alerts",
    body: "Alerts watch a saved query and fire when it crosses a threshold you set. Choose email, Slack or a webhook destination.",
  },
  {
    id: "p15",
    title: "Why an alert did not fire",
    body: "Alerts evaluate on a schedule, not continuously, so a spike shorter than the evaluation window can pass unnoticed. Alerts also suppress repeats for the cooldown period you configured.",
  },
  {
    id: "p16",
    title: "Webhook signing",
    body: "Every webhook carries an X-Signature header, an HMAC of the raw body using your endpoint secret. Verify against the raw bytes, not the parsed JSON.",
  },
  {
    id: "p17",
    title: "Webhook retries",
    body: "A webhook that does not return 2xx within ten seconds is retried with exponential backoff for up to six hours. Retries carry the same delivery id.",
  },
  {
    id: "p18",
    title: "Changing your plan",
    body: "Upgrade or downgrade from Settings → Billing. Upgrades take effect immediately and are prorated; downgrades take effect at the end of the current period.",
  },
  {
    id: "p19",
    title: "Understanding your invoice",
    body: "Invoices itemise seats and ingested event volume separately. Volume is counted on accepted events only — rejected and rate-limited events are not billed.",
  },
  {
    id: "p20",
    title: "Failed payments",
    body: "We retry a failed card three times over ten days. Ingestion continues throughout; after the final failure the project becomes read-only rather than being deleted.",
  },
  {
    id: "p21",
    title: "What happens when your endpoint is unreachable",
    body: "We buffer undelivered data for 72 hours and replay it once your endpoint recovers. Nothing is discarded inside that window, so an outage on your side does not cost you data.",
  },
  {
    id: "p22",
    title: "Data retention",
    body: "Raw events are kept for 13 months on standard plans and 25 months on enterprise. Aggregates are kept indefinitely. Retention can be shortened but not extended retroactively.",
  },
  {
    id: "p23",
    title: "Deleting a project",
    body: "Deleting a project removes its events, dashboards and keys after a 30-day grace period. During the grace period an owner can restore it from Settings → Projects.",
  },
  {
    id: "p24",
    title: "Exporting your data",
    body: "Request a full export from Settings → Data. We produce newline-delimited JSON in object storage and email you a signed link, typically within an hour. There is no charge and no limit on how often you ask.",
  },
]

export interface Query {
  id: string
  text: string
  /** The passage that actually answers it, fixed before either ranker ran. */
  gold: string
}

export const QUERIES: Query[] = [
  {
    id: "q1",
    text: "someone pushed our secret key to a public repo, what do we do now",
    gold: "p05",
  },
  {
    id: "q2",
    text: "we keep getting 429s during our nightly import",
    gold: "p09",
  },
  {
    id: "q3",
    text: "our retry logic fired twice and now everything is counted double",
    gold: "p10",
  },
  {
    id: "q4",
    text: "the card on file bounced, are we about to lose everything",
    gold: "p20",
  },
  {
    id: "q5",
    text: "our server was down for about an hour, did we permanently lose the events from that window",
    gold: "p21",
  },
  {
    id: "q6",
    text: "we are moving to another provider but I need everything we have first",
    gold: "p24",
  },
]

/** One passage is one state; the query rides along so Jev can compare them. */
export const stateFor = (query: Query, passage: Passage) => ({
  question: query.text,
  article: { title: passage.title, body: passage.body },
})
