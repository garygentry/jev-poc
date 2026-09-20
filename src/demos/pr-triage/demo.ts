import type { SingleManifest } from "@/demos/_kit/types"

import { PRS, stateFor, type PullRequest } from "./prs"

/**
 * Five risk reads of one diff, in one request.
 *
 * They share a state — the same PR — so they batch: what area it touches, how
 * far a mistake reaches, whether it can be undone, whether it is tested, and
 * whether it touches security are five questions about one change, not five
 * calls. Each is pinned to something the diff shows, so an author's "trivial
 * cleanup" over a destructive migration cannot lower the read.
 */
export const manifest: SingleManifest<PullRequest> = {
  slug: "pr-triage",
  title: "PR risk triage",
  tagline: "Route review attention by risk, instead of reading every diff alike",
  thesis:
    "Reviewing every diff with the same care wastes attention on typos; reviewing none ships the dangerous ones unseen. A cheap gate reads a PR's risk along a few dimensions, and ordinary code turns that into the only question a reviewer's queue needs answered: does a human have to see this before it merges?",
  group: "engineering",
  order: 1,
  kind: "single",
  shape: { questions: "5", states: "1", requests: "1" },
  primitives: ["choice", "score", "noul"],

  displaces: {
    baseline: "a reviewer reading every diff to the same depth",
    unit: "human-minute",
    baselineUsd: 1.5,
    source: "$90/hr loaded engineer rate, read 2026-09-20",
  },

  questions: {
    area: {
      type: "choice",
      instructions: "Which part of the system this diff mainly touches.",
      criteria: {
        security: "Authentication, authorization, sessions, secrets, crypto, or input validation.",
        data: "Database schema or a data migration — anything that changes stored data or its shape.",
        core: "Application or business logic on a path that real requests depend on.",
        config: "Configuration, dependencies, or build — no application logic of its own.",
        docs_tests: "Documentation or tests only, with no production code changed.",
        other: "None of the above, or it needs a human to say where it belongs.",
      },
    },
    blast_radius: {
      type: "score",
      instructions: "How far a mistake in this change would reach.",
      criteria: [
        "Contained — one non-critical file; a mistake affects only this change.",
        "A feature area — a mistake affects one flow or one part of the product.",
        "A shared path — a mistake reaches many requests or every caller of a common dependency.",
      ],
    },
    reversible: {
      type: "noul",
      instructions:
        "If this shipped broken, could it be undone cheaply — or has it taken an action a plain revert will not fix?",
      criteria: {
        true: "A git revert fully undoes it: the change is code or config with no side effect left behind.",
        false:
          "Undoing it takes more than a revert — a run migration, deleted data, a sent notification, an irreversible external effect.",
      },
    },
    has_tests: {
      type: "noul",
      instructions: "Does the diff add or update tests that exercise the change it makes?",
      criteria: {
        true: "The diff includes a test that drives the new or changed behaviour.",
        false:
          "No test covers the change — none was added, or the diff changes behaviour the added tests do not touch.",
      },
    },
    security_sensitive: {
      type: "noul",
      instructions:
        "Does the change touch authentication, authorization, secrets, crypto, or input validation?",
      criteria: {
        true: "It changes how access is granted or checked, how secrets are handled, or how untrusted input is validated.",
        false: "It does not touch any security-relevant path.",
      },
    },
  },

  examples: PRS.map((pr) => ({ id: pr.id, label: pr.label, input: pr })),

  stateFor,

  estimateCalls: () => 1,
}
