import type { RoundsManifest } from "@/demos/_kit/types"

import { alive, expand, planRound, type Branch, type Round } from "./beam"

import type { ChoiceAnswer } from "@shared/jev.ts"

export interface Case {
  text: string
  /** What a careful human would file it as, written before any run. */
  expected: string
}

const MAX_DEPTH = 3

/**
 * Beam search down a support taxonomy, one request per level.
 *
 * The question set is not fixed: which questions get asked at depth 2 depends
 * on which branches survived depth 1, so this is a `rounds` demo rather than a
 * `single` one. Every question in a round shares the same ticket as state,
 * which is why a wider beam costs more *questions* and not more round trips.
 *
 * `questions` below is therefore empty, and is the one place in this repo where
 * the manifest cannot state the question set up front — the walk builds it.
 */
export const manifest: RoundsManifest<Case, Branch[], Round> = {
  slug: "taxonomy",
  title: "Taxonomy beam search",
  tagline: "Read the distribution, not the winner",
  thesis:
    "Beam search over a taxonomy, carrying several live branches down each level. It only works because the probabilities are calibrated and comparable — an uncalibrated top-1 tells you nothing about whether branch two was nearly as good.",
  group: "foundations",
  order: 5,
  kind: "rounds",
  shape: {
    questions: "1 per live branch",
    states: "1",
    requests: "1 per level",
  },
  primitives: ["choice"],

  questions: {},

  examples: [
    {
      id: "webhook",
      label: "Webhook silence",
      input: {
        text: "We stopped getting delivery callbacks around 14:00 yesterday. Our endpoint is up and returning 200 to our own health checks. Nothing in our logs at all from you since then.",
        expected: "technical › delivery › webhook_not_firing",
      },
    },
    {
      id: "double-bill",
      label: "Invoice doubled",
      input: {
        text: "Our invoice this month is exactly twice what it was last month and our usage has not changed. Can someone explain what the second line item is?",
        expected: "billing › invoices › invoice_line_items",
      },
    },
    {
      id: "leaving",
      label: "Leaving, wants data",
      input: {
        text: "We've decided to move to a different vendor at the end of the quarter. Before we do I need a complete copy of everything we've sent you over the last two years.",
        expected: "data › export › full_export",
      },
    },
    {
      id: "ambiguous-billing",
      label: "Ambiguous inside billing",
      input: {
        text: "Something's wrong with how our card is being charged and I can't work out what. It might have been declined and retried, it might have gone through twice, or it might be tangled up with the new card we added last week — I honestly can't tell which. Either way the amount leaving our account is not what it should be.",
        expected: "billing › payments (the leaf is genuinely unclear)",
      },
    },
    {
      id: "sso",
      label: "SSO rollout",
      input: {
        text: "We're rolling out Okta across the company next month. What do we need to configure on your side, and does it work on our current plan?",
        expected: "account › access › sso_setup",
      },
    },
  ],

  stateFor: (item) => ({ ticket: item.text }),

  walk: {
    initial: [{ path: [], probability: 1, confidence: 1 }],
    maxDepth: MAX_DEPTH,

    plan: (depth, branches) => {
      const round = planRound(depth, alive(branches))
      return round ? { questions: round.questions, round } : null
    },

    advance: (round, answers, branches) => {
      const choices: Record<string, ChoiceAnswer> = {}
      for (const [name, answer] of Object.entries(answers)) {
        if (answer.type === "choice") choices[name] = answer
      }

      // Branches that already stopped are carried through unchanged so the
      // tree keeps showing them rather than dropping them from the display.
      const stopped = branches.filter((branch) => branch.stoppedBecause)
      return [...expand(round, choices), ...stopped]
    },
  },

  estimateCalls: () => MAX_DEPTH,
}
