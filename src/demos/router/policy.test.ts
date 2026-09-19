import { describe, expect, it } from "vitest"

import { CAPABILITY_FLOOR, TRUSTED_CONFIDENCE, chooseModel } from "./policy"
import { LADDER } from "./models"

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
    required_capability: choice("simple"),
    task_type: choice("writing"),
    needs_tools: noul(0.02),
    needs_long_context: noul(0.02),
    needs_vision: noul(0.01),
    is_ambiguous: noul(0.05),
    ...overrides,
  } as Record<string, JevAnswer>
}

describe("chooseModel", () => {
  it("routes a simple request to the cheapest model", () => {
    expect(chooseModel(answers()).model).toBe("haiku")
  })

  it("routes expert work to the most capable model", () => {
    expect(
      chooseModel(answers({ required_capability: choice("expert") })).model,
    ).toBe("opus")
  })

  it("lifts a Haiku-floor request off Haiku when it needs long context", () => {
    // Haiku's window is 200k; the others are 1M. This is a hard capability
    // limit, not a quality judgement.
    const route = chooseModel(
      answers({ needs_long_context: noul(0.94) }),
    )
    expect(route.model).toBe("sonnet")
    expect(route.reasons.join(" ")).toMatch(/context/)
  })

  it("promotes rather than guessing when the classification is weak", () => {
    const route = chooseModel(
      answers({ required_capability: choice("simple", TRUSTED_CONFIDENCE - 0.01) }),
    )
    expect(route.model).toBe("sonnet")
    expect(route.reasons.join(" ")).toMatch(/promoted/)
  })

  it("promotes on a flat distribution", () => {
    const route = chooseModel(
      answers({ required_capability: choice("simple", 0) }),
    )
    expect(route.model).toBe("sonnet")
    expect(route.reasons.join(" ")).toMatch(/flat/)
  })

  it("flags an ambiguous request for clarification instead of routing it", () => {
    const route = chooseModel(answers({ is_ambiguous: noul(0.88) }))
    expect(route.clarifyFirst).toBe(true)
  })

  it("defaults an unrecognised capability upward, never down", () => {
    // A new option added to the question but not to the floor table must not
    // silently route to the cheapest model.
    expect(
      chooseModel(answers({ required_capability: choice("superhuman") })).model,
    ).toBe("opus")
  })

  it("never demotes below the capability floor, whatever else holds", () => {
    // The order-independence property: every rule can only raise the floor, so
    // adding one can never make an existing route cheaper.
    for (const [capability, floor] of Object.entries(CAPABILITY_FLOOR)) {
      const route = chooseModel(
        answers({
          required_capability: choice(capability),
          needs_tools: noul(0.99),
          needs_long_context: noul(0.99),
        }),
      )
      expect(LADDER.indexOf(route.model)).toBeGreaterThanOrEqual(
        LADDER.indexOf(floor),
      )
    }
  })

  it("rejects an answer set whose primitives do not match the questions", () => {
    expect(() =>
      chooseModel(answers({ required_capability: noul(0.5) })),
    ).toThrow(/choice/)
  })
})
