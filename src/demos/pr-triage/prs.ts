import type { JevState } from "@shared/jev.ts"

/** One pull request, as a reviewer first meets it: title, blurb, and the diff. */
export interface PullRequest {
  id: string
  label: string
  title: string
  /** The author's description — what they say it does. */
  description: string
  /** The diff, summarised the way a review tool shows it: files, hunks, counts. */
  diff: string
  /** A one-line human note on why it lands where it does. Not sent to the model. */
  note: string
}

/**
 * What the gate judges: the whole PR at once.
 *
 * Title, description and diff ride in one state because the risk questions are
 * all about the *same* change — whether it touches auth and whether it has tests
 * are two reads of one diff, so they batch into a single request rather than
 * five. The description is included but the risk is pinned to the diff: an author
 * who writes "trivial cleanup" over a migration should not talk the gate down.
 */
export const stateFor = (pr: PullRequest): JevState => ({
  title: pr.title,
  description: pr.description,
  diff: pr.diff,
})

/**
 * Six pull requests spread across the review tiers, and across *why* they land
 * there — so no single dimension decides all of them.
 *
 * Two are safe (a doc typo, a tests-only change). One earns a glance (a shared
 * config default, changed without a test). Three need real review, each for a
 * different reason a diff-blind rule would miss: it touches auth, it runs an
 * irreversible migration, or it is a large untested feature on a shared path.
 * Reviewing all six alike wastes attention on the first two; reviewing none
 * ships the last three unseen.
 */
export const PRS: PullRequest[] = [
  {
    id: "readme-typo",
    label: "Fix a README typo",
    title: "Fix typo in README",
    description: "Small doc fix — 'recieve' → 'receive' in the setup section.",
    diff: "README.md (+1 −1)\n- Once you recieve your API key, add it to .env\n+ Once you receive your API key, add it to .env",
    note: "Docs only, one character — no human needed.",
  },
  {
    id: "add-tests",
    label: "Add tests for the parser",
    title: "Add unit tests for the CSV parser",
    description: "Backfills tests for the existing csv parser. No production code changed.",
    diff: "parser/csv.test.ts (+64)\n+ describe('parseCsv', () => { … 9 new cases covering quoting, escapes, empty fields … })\nNo changes under src/. Full suite: 233 passed.",
    note: "Tests only, no production change — safe to merge.",
  },
  {
    id: "config-default",
    label: "Change a shared config default",
    title: "Raise the default request timeout to 30s",
    description: "Bumps the global HTTP client default timeout from 10s to 30s, with a test.",
    diff: "config/http.ts (+1 −1)\n- export const DEFAULT_TIMEOUT_MS = 10_000\n+ export const DEFAULT_TIMEOUT_MS = 30_000\nconfig/http.test.ts (+1) — asserts a client built with no explicit timeout uses 30_000.\nThis default is imported by every outbound client.",
    note: "A shared default many callers inherit, but tested — a glance, not a full review.",
  },
  {
    id: "new-endpoint",
    label: "Add an export endpoint (no tests)",
    title: "Add POST /reports/export",
    description: "New endpoint that streams a full account export. Ships the handler, the query, and the route wiring.",
    diff: "api/reports/export.ts (+142) — new handler: builds a query across accounts, orders, and invoices; streams CSV.\napi/router.ts (+3) — mounts the route.\nservices/report.ts (+38) — the export query.\nNo tests added. Touches the shared account/order/invoice read path.",
    note: "Large untested feature on a shared data path — needs real review.",
  },
  {
    id: "auth-session",
    label: "Tweak session validation",
    title: "Accept tokens signed within a 5-minute clock skew",
    description: "Small change so tokens just past expiry due to clock skew still validate. One test added.",
    diff: "auth/session.ts (+6 −2)\n- if (token.exp < now) return reject()\n+ if (token.exp < now - SKEW_MS) return reject()   // SKEW_MS = 5 * 60_000\nauth/session.test.ts (+1) — asserts a token 3 minutes past exp is accepted.",
    note: "Tiny and tested, but it widens the auth window — a human must see it.",
  },
  {
    id: "drop-column",
    label: "Drop a deprecated column",
    title: "Remove the unused users.legacy_id column",
    description: "Cleanup: drops a column we stopped writing months ago.",
    diff: "migrations/0042_drop_legacy_id.sql (+1)\n+ ALTER TABLE users DROP COLUMN legacy_id;\nmodels/user.ts (−1) — removes the field.\nNo backfill, no down migration. Runs on deploy against production.",
    note: "A destructive migration with no down path — irreversible, needs review.",
  },
]
