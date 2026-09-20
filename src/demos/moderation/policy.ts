import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"

import { POLICIES, type Policy, type Severity } from "./policies"

/** What to do with the content: allow, queue for a human, or hard-block. */
export type Action = "allow" | "review" | "block"

export const ACTION_LABEL: Record<Action, string> = {
  allow: "allow",
  review: "queue for review",
  block: "block",
}

/** One policy's verdict on the content. */
export interface Decision {
  policy: Policy
  /** The gate's probability, or null if it went unanswered. */
  probability: number | null
  tripped: boolean
}

export interface Moderation {
  action: Action
  decisions: Decision[]
  /** The policies that tripped, most severe first. */
  tripped: Decision[]
  trace: PolicyLine[]
}

const RANK: Record<Action, number> = { allow: 0, review: 1, block: 2 }
const actionOf = (severity: Severity): Action => severity

/**
 * Turn twelve per-policy nouls into one action.
 *
 * A policy trips when its own probability clears its own threshold — never a
 * shared cutoff. The action is the most severe among the policies that tripped,
 * so a single `block` policy is decisive while `review` policies only escalate
 * an otherwise-allowed message. A missing answer never trips: silence is not a
 * violation, and inventing one would block on the gate's own gaps.
 */
export function moderate(answers: Record<string, JevAnswer>): Moderation {
  const decisions: Decision[] = POLICIES.map((policy) => {
    const answer = answers[policy.key]
    const probability = answer?.type === "noul" ? answer.noul : null
    return {
      policy,
      probability,
      tripped: probability !== null && probability >= policy.threshold,
    }
  })

  const tripped = decisions
    .filter((d) => d.tripped)
    .sort((a, b) => RANK[actionOf(b.policy.severity)] - RANK[actionOf(a.policy.severity)])

  const action: Action = tripped.reduce<Action>(
    (worst, d) => (RANK[actionOf(d.policy.severity)] > RANK[worst] ? actionOf(d.policy.severity) : worst),
    "allow",
  )

  const trace: PolicyLine[] = [
    { code: "// each policy trips on its own threshold" },
    { code: "tripped = policies.filter(p => noul[p] >= p.threshold)", fired: tripped.length > 0, note: `${tripped.length} tripped` },
    { code: "return worstSeverity(tripped)  // block > review > allow", fired: true, note: ACTION_LABEL[action] },
  ]

  return { action, decisions, tripped, trace }
}
