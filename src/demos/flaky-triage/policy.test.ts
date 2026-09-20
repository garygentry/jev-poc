import { describe, expect, it } from "vitest"

import { DETERMINISTIC_MAX, RETRY_CONFIDENCE, triageFailure } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const choice = (pick: string, confidence = 0.9): JevAnswer => ({
  type: "choice",
  choice: pick,
  confidence,
  probabilities: { [pick]: confidence },
})
const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

describe("triageFailure", () => {
  it("auto-retries a confident, nondeterministic flake", () => {
    const t = triageFailure({ category: choice("flaky"), deterministic: noul(0.1) })
    expect(t.action).toBe("retry")
  })

  it("blocks a confident regression", () => {
    const t = triageFailure({ category: choice("regression"), deterministic: noul(0.95) })
    expect(t.action).toBe("block")
  })

  it("routes an infra failure to a clean-runner re-run", () => {
    const t = triageFailure({ category: choice("infra"), deterministic: noul(0.2) })
    expect(t.action).toBe("infra")
  })

  it("does not auto-retry a flaky verdict held with low confidence", () => {
    const t = triageFailure({
      category: choice("flaky", RETRY_CONFIDENCE - 0.05),
      deterministic: noul(0.1),
    })
    expect(t.action).toBe("human")
    expect(t.reason).toMatch(/sure/)
  })

  it("does not auto-retry a flake that looks deterministic", () => {
    // Confident it is flaky, but it would reproduce — a re-run would not help,
    // and retrying it is how a masked regression starts.
    const t = triageFailure({
      category: choice("flaky", 0.9),
      deterministic: noul(DETERMINISTIC_MAX + 0.1),
    })
    expect(t.action).toBe("human")
    expect(t.reason).toMatch(/reproduce/)
  })

  it("surfaces a flat classification to a human", () => {
    const t = triageFailure({ category: choice("flaky", 0.05), deterministic: noul(0.1) })
    expect(t.action).toBe("human")
    expect(t.reason).toMatch(/clearly/)
  })

  it("does not block a regression guessed with low confidence", () => {
    // Being wrong about a block is cheap here, but the confidence floor still
    // holds: a coin-flip regression read goes to a human, not an auto-block.
    const t = triageFailure({ category: choice("regression", 0.5), deterministic: noul(0.9) })
    expect(t.action).toBe("human")
  })

  it("rejects an answer set whose primitives do not match the questions", () => {
    expect(() => triageFailure({ category: noul(0.5) })).toThrow(/choice/)
  })
})
