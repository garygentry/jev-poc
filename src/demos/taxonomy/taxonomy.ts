/**
 * A three-level support taxonomy, continuing the vocabulary of the triage and
 * re-rank demos.
 *
 * Classifying into ~40 leaves with one flat Choice would mean a 40-option
 * question, which is both expensive and badly posed — most of the options are
 * irrelevant to any given ticket. Descending the tree asks a handful of small,
 * well-separated questions instead.
 */
export interface Node {
  key: string
  label: string
  /** When this node applies. Becomes the option's criterion text. */
  description: string
  children?: Node[]
}

export const TAXONOMY: Node[] = [
  {
    key: "billing",
    label: "Billing",
    description: "Money: charges, invoices, plans, payment methods.",
    children: [
      {
        key: "payments",
        label: "Payments",
        description: "A charge that did or did not go through.",
        children: [
          { key: "card_declined", label: "Card declined", description: "A payment method was refused by the issuer." },
          { key: "failed_payment_recovery", label: "Failed payment recovery", description: "What happens to the account after a payment fails." },
          { key: "payment_method_change", label: "Payment method change", description: "Adding, removing or updating a card or bank detail." },
        ],
      },
      {
        key: "invoices",
        label: "Invoices",
        description: "The document, its contents, and what it charges for.",
        children: [
          { key: "invoice_amount", label: "Unexpected amount", description: "The total is not what the customer expected." },
          { key: "invoice_line_items", label: "Line items", description: "What a specific charge on the invoice refers to." },
          { key: "tax_and_vat", label: "Tax and VAT", description: "Tax treatment, VAT numbers, or exemption." },
          { key: "receipts", label: "Receipts", description: "Obtaining or correcting a receipt." },
        ],
      },
      {
        key: "plans",
        label: "Plans",
        description: "Which plan the customer is on and moving between them.",
        children: [
          { key: "upgrade", label: "Upgrade", description: "Moving to a larger plan." },
          { key: "downgrade", label: "Downgrade", description: "Moving to a smaller plan." },
          { key: "cancellation", label: "Cancellation", description: "Ending the subscription entirely." },
        ],
      },
    ],
  },
  {
    key: "technical",
    label: "Technical",
    description: "The product not doing what it should: errors, failures, limits.",
    children: [
      {
        key: "ingestion",
        label: "Ingestion",
        description: "Getting events into the system.",
        children: [
          { key: "events_missing", label: "Events not arriving", description: "Data was sent but does not appear." },
          { key: "rate_limited", label: "Rate limited", description: "Requests are being rejected for volume." },
          { key: "batch_rejected", label: "Batch rejected", description: "A multi-event request failed validation." },
          { key: "duplicate_events", label: "Duplicates", description: "The same event was recorded more than once." },
        ],
      },
      {
        key: "delivery",
        label: "Delivery",
        description: "Getting data back out: webhooks and destinations.",
        children: [
          { key: "webhook_not_firing", label: "Webhook not firing", description: "An expected delivery never arrived." },
          { key: "webhook_retries", label: "Retries and backoff", description: "How failed deliveries are re-attempted." },
          { key: "signature_mismatch", label: "Signature mismatch", description: "Verification of a delivery's signature fails." },
        ],
      },
      {
        key: "dashboards",
        label: "Dashboards",
        description: "Querying, visualising and alerting on stored data.",
        children: [
          { key: "query_results", label: "Unexpected query results", description: "A query returns numbers the customer disputes." },
          { key: "tile_refresh", label: "Tiles not refreshing", description: "A dashboard shows stale data." },
          { key: "alert_not_firing", label: "Alert not firing", description: "A configured alert did not trigger when expected." },
        ],
      },
    ],
  },
  {
    key: "account",
    label: "Account",
    description: "Who can get in and what they are allowed to do.",
    children: [
      {
        key: "access",
        label: "Access",
        description: "Signing in.",
        children: [
          { key: "cannot_log_in", label: "Cannot log in", description: "Credentials are rejected or the flow fails." },
          { key: "sso_setup", label: "SSO setup", description: "Configuring single sign-on." },
          { key: "mfa", label: "Multi-factor", description: "Enrolling in or recovering from MFA." },
        ],
      },
      {
        key: "members",
        label: "Members",
        description: "The people on the account.",
        children: [
          { key: "invites", label: "Invitations", description: "Inviting someone, or an invitation that did not work." },
          { key: "roles", label: "Roles", description: "What a given role can and cannot do." },
          { key: "seats", label: "Seats", description: "How many people the plan allows." },
        ],
      },
    ],
  },
  {
    key: "data",
    label: "Data",
    description: "What is stored, for how long, and how to get it out.",
    children: [
      {
        key: "export",
        label: "Export",
        description: "Taking data out of the product.",
        children: [
          { key: "full_export", label: "Full export", description: "A complete copy of everything stored." },
          { key: "export_format", label: "Format and schema", description: "The shape of exported files." },
        ],
      },
      {
        key: "retention",
        label: "Retention",
        description: "How long data is kept.",
        children: [
          { key: "retention_window", label: "Retention window", description: "How far back data remains queryable." },
          { key: "early_deletion", label: "Early deletion", description: "Removing data before the retention window ends." },
        ],
      },
      {
        key: "privacy",
        label: "Privacy",
        description: "Regulatory obligations about personal data.",
        children: [
          { key: "dsar", label: "Subject access request", description: "An individual asking what is held about them." },
          { key: "dpa", label: "Data processing agreement", description: "Contractual terms for processing personal data." },
        ],
      },
    ],
  },
  {
    key: "feedback",
    label: "Feedback",
    description: "Not a problem to solve: an opinion about the product.",
    children: [
      {
        key: "requests",
        label: "Requests",
        description: "Something the customer wants that does not exist.",
        children: [
          { key: "feature_request", label: "Feature request", description: "A capability the product does not have." },
          { key: "integration_request", label: "Integration request", description: "A third-party service to connect to." },
        ],
      },
      {
        key: "reports",
        label: "Reports",
        description: "Something the customer thinks is wrong with the product itself.",
        children: [
          { key: "bug_report", label: "Bug report", description: "Behaviour the customer believes is incorrect." },
          { key: "docs_gap", label: "Documentation gap", description: "Something undocumented or documented wrongly." },
        ],
      },
    ],
  },
]

/** Children of the node at `path`, or the roots when the path is empty. */
export function childrenAt(path: string[]): Node[] {
  let level = TAXONOMY
  for (const key of path) {
    const node = level.find((candidate) => candidate.key === key)
    if (!node?.children) return []
    level = node.children
  }
  return level
}

export function labelAt(path: string[]): string {
  const labels: string[] = []
  let level = TAXONOMY
  for (const key of path) {
    const node = level.find((candidate) => candidate.key === key)
    if (!node) break
    labels.push(node.label)
    level = node.children ?? []
  }
  return labels.join(" › ")
}

/** Total leaves, quoted in the UI to make the flat-Choice alternative concrete. */
export const LEAF_COUNT = TAXONOMY.reduce(
  (total, l1) =>
    total +
    (l1.children ?? []).reduce(
      (sub, l2) => sub + (l2.children?.length ?? 0),
      0,
    ),
  0,
)
