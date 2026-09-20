import { describe, expect, it } from "vitest"

import { DIFFICULTY_FLOOR, TRUSTED_CONFIDENCE, chooseTier } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const choice = (pick: string, confidence = 0.95): JevAnswer => ({
  type: "choice",
  choice: pick,
  confidence,
  probabilities: { [pick]: confidence },
})

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

function answers(overrides: Partial<Record<string, JevAnswer>> = {}) {
  return {
    difficulty: choice("routine"),
    high_stakes: noul(0.05),
    ...overrides,
  } as Record<string, JevAnswer>
}

describe("chooseTier", () => {
  it("routes a routine, low-stakes request to the cheap tier", () => {
    expect(chooseTier(answers()).tier).toBe("haiku")
  })

  it("routes expert work to the frontier", () => {
    expect(chooseTier(answers({ difficulty: choice("expert") })).tier).toBe("opus")
  })

  it("promotes a routine request when the stakes are high", () => {
    // The rule that keeps the saving honest: an expensive, hard-to-notice error
    // is worth the frontier even on work that reads as easy.
    const cascade = chooseTier(answers({ high_stakes: noul(0.9) }))
    expect(cascade.tier).toBe("opus")
    expect(cascade.reasons.join(" ")).toMatch(/irreversible/)
  })

  it("promotes rather than guessing when the gate is weak", () => {
    const cascade = chooseTier(
      answers({ difficulty: choice("routine", TRUSTED_CONFIDENCE - 0.01) }),
    )
    expect(cascade.tier).toBe("opus")
    expect(cascade.reasons.join(" ")).toMatch(/promoted/)
  })

  it("promotes on a flat difficulty read", () => {
    const cascade = chooseTier(answers({ difficulty: choice("routine", 0) }))
    expect(cascade.tier).toBe("opus")
    expect(cascade.reasons.join(" ")).toMatch(/flat/)
  })

  it("defaults an unrecognised difficulty upward, never down", () => {
    // A new option added to the question but not to the floor table must not
    // silently route to the cheap tier.
    expect(chooseTier(answers({ difficulty: choice("trivial") })).tier).toBe("opus")
  })

  it("never demotes below the difficulty floor, whatever else holds", () => {
    // The order-independence property: every rule can only raise the tier, so
    // adding one can never make an existing route cheaper.
    for (const [difficulty, floor] of Object.entries(DIFFICULTY_FLOOR)) {
      const cascade = chooseTier(
        answers({
          difficulty: choice(difficulty),
          high_stakes: noul(0.99),
        }),
      )
      const rank = { haiku: 0, opus: 1 } as const
      expect(rank[cascade.tier]).toBeGreaterThanOrEqual(rank[floor])
    }
  })

  it("rejects an answer set whose primitives do not match the questions", () => {
    expect(() => chooseTier(answers({ difficulty: noul(0.5) }))).toThrow(/choice/)
  })
})
