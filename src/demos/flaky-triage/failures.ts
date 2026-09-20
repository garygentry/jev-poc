import type { JevState } from "@shared/jev.ts"

/** One CI failure, as it lands in front of an engineer: which test, and the output. */
export interface Failure {
  id: string
  label: string
  /** The failing test's name. */
  test: string
  /** The failure output — stack, assertion, or runner message — as CI printed it. */
  output: string
  /** A one-line human note on what it really is. Not sent to the model. */
  note: string
}

/**
 * What the gate judges: the failing test and its output, together.
 *
 * The output is where the tell lives — a timeout that passed on the last forty
 * runs reads flaky, an assertion that fails on every re-run reads like a
 * regression, an OOM-killed runner reads like infra. The classification is
 * pinned to that text so it cannot be talked around by the test's name alone.
 */
export const stateFor = (failure: Failure): JevState => ({
  test: failure.test,
  output: failure.output,
})

/**
 * Six CI failures across the three classes and the surface a gate falls back to.
 *
 * Two flakes (a race, a leaked mock) and two regressions (a wrong assertion, a
 * new crash) so the *reason* differs within a class, not just the label; one
 * clear infra failure; and one whose output says too little to classify, which
 * a gate must hand to a human rather than guess. Auto-retrying all of them hides
 * the two regressions behind a green re-run; retrying none makes an engineer
 * read every timeout by hand.
 */
export const FAILURES: Failure[] = [
  {
    id: "flaky-timeout",
    label: "Flake — a UI timing race",
    test: "checkout.e2e.ts › shows the confirmation toast",
    output:
      "TimeoutError: waiting for selector '.toast-success' — not visible after 5000ms. This test passed on the previous 41 runs; the toast renders after an animation that occasionally exceeds the wait.",
    note: "A nondeterministic timing race — safe to auto-retry.",
  },
  {
    id: "real-assertion",
    label: "Regression — a wrong status code",
    test: "auth.test.ts › accepts a valid session token",
    output:
      "AssertionError: expected 200 to equal 403. The auth middleware now rejects tokens it previously accepted. Reproduced on all 3 reruns in this job; git bisect points at the session change in this PR.",
    note: "Deterministic and reproduced — a real regression to block on.",
  },
  {
    id: "infra-oom",
    label: "Infra — runner out of memory",
    test: "reports.test.ts › aggregates a year of invoices",
    output:
      "Process terminated with exit code 137. The runner was OOMKilled during test setup before any assertion ran. Peak memory hit the 2GB container limit while seeding fixtures.",
    note: "The runner died, not the test — an infra problem.",
  },
  {
    id: "flaky-order",
    label: "Flake — a leaked mock",
    test: "profile.test.ts › renders the user's name",
    output:
      "TypeError: fetch is not a function. Fails only when run after payment.test.ts, which replaces global fetch and never restores it. Passes in isolation and when the suite order is shuffled away from that pairing.",
    note: "An order-dependent flake from a leaked global — flaky, though messier.",
  },
  {
    id: "real-crash",
    label: "Regression — a new crash",
    test: "users.test.ts › formats a user for the header",
    output:
      "TypeError: Cannot read properties of undefined (reading 'displayName') at formatUser (users/format.ts:12). The new guest code path returns undefined where a user was assumed. Fails identically on every run.",
    note: "A deterministic new crash from a code path just added — a regression.",
  },
  {
    id: "unclear",
    label: "Unclear — an uninformative log",
    test: "sync.test.ts › reconciles the ledger",
    output:
      "Test failed after 4.2s. Exit code 1. No assertion message, stack trace, or output was captured — the reporter was killed before it could flush. Nothing here says whether the code, the environment, or a flake is at fault.",
    note: "Too little in the output to classify — surface it to a human.",
  },
]
