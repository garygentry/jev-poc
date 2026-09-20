import { describe, expect, it } from "vitest"

import { POLICIES } from "./policies"
import { moderate } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

/** All policies well below their thresholds unless overridden. */
function answers(overrides: Record<string, number> = {}) {
  const base: Record<string, JevAnswer> = {}
  for (const p of POLICIES) base[p.key] = noul(overrides[p.key] ?? 0.02)
  for (const [k, v] of Object.entries(overrides)) base[k] = noul(v)
  return base
}

describe("moderate", () => {
  it("allows content that trips nothing", () => {
    const m = moderate(answers())
    expect(m.action).toBe("allow")
    expect(m.tripped).toHaveLength(0)
  })

  it("blocks when a block-severity policy trips", () => {
    const m = moderate(answers({ threat: 0.9 }))
    expect(m.action).toBe("block")
    expect(m.tripped[0]?.policy.key).toBe("threat")
  })

  it("queues for review when only a review-severity policy trips", () => {
    const m = moderate(answers({ harassment: 0.9 }))
    expect(m.action).toBe("review")
  })

  it("takes the most severe action when policies of both kinds trip", () => {
    const m = moderate(answers({ harassment: 0.9, threat: 0.9 }))
    expect(m.action).toBe("block")
    // Block-severity sorts ahead of review in the tripped list.
    expect(m.tripped[0]?.policy.severity).toBe("block")
  })

  it("uses each policy's own threshold, not a shared cutoff", () => {
    // 0.5 clears the threat threshold (0.45) but not spam's (0.8).
    expect(moderate(answers({ threat: 0.5 })).action).toBe("block")
    expect(moderate(answers({ spam: 0.5 })).action).toBe("allow")
    expect(moderate(answers({ spam: 0.85 })).action).toBe("review")
  })

  it("does not trip a policy on a missing answer", () => {
    const partial = answers()
    delete partial.threat
    const m = moderate(partial)
    const threat = m.decisions.find((d) => d.policy.key === "threat")
    expect(threat?.probability).toBeNull()
    expect(threat?.tripped).toBe(false)
  })

  it("keeps every policy in the decisions, tripped or not", () => {
    expect(moderate(answers()).decisions).toHaveLength(POLICIES.length)
  })
})
