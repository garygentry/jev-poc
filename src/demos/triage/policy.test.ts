import { describe, expect, it } from "vitest"

import { BILLING_CONFIDENCE, ROUTABLE_CONFIDENCE, route } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

/**
 * The routing policy is pure code: answers in, decision out. It is tested
 * directly — no key, no network, no model.
 *
 * That split is deliberate. Model quality is measured against your own data;
 * policy correctness is measured by tests that run in milliseconds and catch
 * the kind of mistake that would otherwise only show up in production.
 */

const choice = (
  pick: string,
  confidence: number,
  probabilities?: Record<string, number>,
): JevAnswer => ({
  type: "choice",
  choice: pick,
  confidence,
  probabilities: probabilities ?? { [pick]: confidence, other: 1 - confidence },
})

const score = (value: number, confidence = 0.9): JevAnswer => ({
  type: "score",
  score: value,
  confidence,
  probabilities: { "0": 0.1, "1": 0.8, "2": 0.1 },
})

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

function answers(overrides: Partial<Record<string, JevAnswer>> = {}) {
  return {
    department: choice("technical", 0.95),
    frustration: score(0.2),
    business_impact: score(0.3),
    is_urgent: noul(0.1),
    threatens_churn: noul(0.02),
    refund_requested: noul(0.02),
    is_repeat_contact: noul(0.05),
    ...overrides,
  } as Record<string, JevAnswer>
}

describe("route", () => {
  it("auto-routes a confident, low-heat ticket to the standard queue", () => {
    const { decision } = route(answers())
    expect(decision.queue).toBe("technical/standard")
    expect(decision.human).toBe(false)
  })

  it("escalates a churn threat ahead of every other branch", () => {
    const { decision } = route(
      answers({
        threatens_churn: noul(0.91),
        // Deliberately also below the routing floor: churn must win anyway.
        department: choice("billing", 0.3),
      }),
    )
    expect(decision.queue).toBe("retention")
    expect(decision.human).toBe(true)
  })

  it("does not escalate churn on a probability at the threshold", () => {
    // The rule is `> LIKELY`, not `>=`. Pinning it stops a later edit from
    // quietly widening what counts as a threat.
    const { decision } = route(answers({ threatens_churn: noul(0.7) }))
    expect(decision.queue).toBe("technical/standard")
  })

  it("sends a low-confidence department to a human", () => {
    const { decision } = route(
      answers({ department: choice("technical", ROUTABLE_CONFIDENCE - 0.01) }),
    )
    expect(decision.queue).toBe("human-review")
    expect(decision.notes.join(" ")).toContain("below")
  })

  it("holds billing to a higher bar than technical at the same confidence", () => {
    const confidence = (ROUTABLE_CONFIDENCE + BILLING_CONFIDENCE) / 2

    expect(route(answers({ department: choice("technical", confidence) })).decision.human).toBe(
      false,
    )
    // Same number, different branch, different outcome — this is the whole
    // reason the two constants exist separately.
    expect(route(answers({ department: choice("billing", confidence) })).decision.human).toBe(
      true,
    )
  })

  it("refuses to act on a flat distribution even at a routable-looking confidence", () => {
    const { decision } = route(answers({ department: choice("technical", 0) }))
    expect(decision.queue).toBe("human-review")
    expect(decision.notes.join(" ")).toContain("could not tell")
  })

  it("prioritises only when urgency and impact both hold", () => {
    const urgentOnly = route(
      answers({ is_urgent: noul(0.95), business_impact: score(0.4) }),
    )
    expect(urgentOnly.decision.queue).toBe("technical/standard")

    const impactOnly = route(
      answers({ is_urgent: noul(0.1), business_impact: score(1.9) }),
    )
    expect(impactOnly.decision.queue).toBe("technical/standard")

    const both = route(
      answers({ is_urgent: noul(0.95), business_impact: score(1.9) }),
    )
    expect(both.decision.queue).toBe("technical/priority")
  })

  it("ignores an undecided impact score rather than reading it as a value", () => {
    // confidence 0 is a flat distribution: Jev cannot tell. Treating the 1.6 as
    // a real reading would escalate on a number that means nothing.
    const { decision } = route(
      answers({ is_urgent: noul(0.95), business_impact: score(1.6, 0) }),
    )
    expect(decision.queue).toBe("technical/standard")
  })

  it("annotates without gating", () => {
    const { decision } = route(
      answers({ refund_requested: noul(0.9), is_repeat_contact: noul(0.9) }),
    )
    expect(decision.queue).toBe("technical/standard")
    expect(decision.notes).toContain("refund requested")
    expect(decision.notes).toContain("repeat contact")
  })

  it("marks the branch it actually took in the trace", () => {
    const { trace } = route(answers({ threatens_churn: noul(0.95) }))
    const fired = trace.filter((line) => line.fired)
    expect(fired.map((line) => line.code).join("\n")).toContain("retention")
  })

  it("rejects an answer set whose primitives do not match the questions", () => {
    expect(() => route(answers({ department: noul(0.5) }))).toThrow(/choice/)
  })
})
