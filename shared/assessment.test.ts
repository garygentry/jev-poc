import { describe, expect, it } from "vitest"

import { aggregate, rollup, summariseDemo } from "./assessment.ts"
import type { DemoInput } from "./assessment.ts"

/** Three calls: one full agreement, one full disagreement, one parse failure. */
const demo: DemoInput = {
  slug: "demo",
  title: "Demo",
  kind: "single",
  group: "foundations",
  pairs: [
    {
      key: "a",
      jev: {
        answers: {
          dept: { type: "choice", choice: "a", probabilities: { a: 0.95, b: 0.05 }, confidence: 0.9 },
          sev: { type: "score", score: 2, probabilities: { "2": 1 }, confidence: 0.8 },
          urgent: { type: "noul", noul: 0.9 },
        },
        usage: { input_tokens: 100, output_tokens: 50, cost: 0.001 },
      },
      baseline: {
        answers: {
          dept: { type: "choice", choice: "a" },
          sev: { type: "score", score: 2 },
          urgent: { type: "noul", noul: 0.8 },
        },
        usage: { input_tokens: 200, output_tokens: 30, cost: 0.01 },
        parseOk: true,
      },
    },
    {
      key: "b",
      jev: {
        answers: {
          dept: { type: "choice", choice: "b", probabilities: { a: 0.5, b: 0.5 }, confidence: 0.1 },
          sev: { type: "score", score: 1, probabilities: { "1": 1 }, confidence: 0.5 },
          urgent: { type: "noul", noul: 0.5 },
        },
        usage: { input_tokens: 120, output_tokens: 60, cost: 0.002 },
      },
      baseline: {
        answers: {
          dept: { type: "choice", choice: "a" },
          sev: { type: "score", score: 0 },
          urgent: { type: "noul", noul: 0.2 },
        },
        usage: { input_tokens: 210, output_tokens: 20, cost: 0.02 },
        parseOk: true,
      },
    },
    {
      key: "c",
      jev: {
        answers: {
          dept: { type: "choice", choice: "a", probabilities: { a: 1, b: 0 }, confidence: 1 },
          sev: { type: "score", score: 2, probabilities: { "2": 1 }, confidence: 1 },
          urgent: { type: "noul", noul: 0.99 },
        },
        usage: { input_tokens: 100, output_tokens: 50, cost: 0.001 },
      },
      baseline: {
        answers: null,
        usage: { input_tokens: 100, output_tokens: 10, cost: 0.005 },
        parseOk: false,
      },
    },
  ],
}

describe("summariseDemo", () => {
  const e = summariseDemo(demo)

  it("sums cost and tokens on both sides", () => {
    expect(e.cost.jevCalls).toBe(3)
    expect(e.cost.baselineCalls).toBe(3)
    expect(e.cost.jevCost).toBeCloseTo(0.004, 6)
    expect(e.cost.baselineCost).toBeCloseTo(0.035, 6)
    expect(e.cost.jevCostPerCall).toBeCloseTo(0.004 / 3, 6)
    expect(e.cost.baselineCostPerCall).toBeCloseTo(0.035 / 3, 6)
    expect(e.cost.costRatio).toBeCloseTo(8.75, 4)
  })

  it("counts agreement only where both models answered", () => {
    // c's baseline did not parse, so its three questions are never compared.
    expect(e.agreement.compared).toBe(6)
    expect(e.agreement.agree).toBe(3)
    expect(e.agreement.agreementRate).toBeCloseTo(0.5, 6)
    expect(e.agreement.byType.choice).toEqual({ compared: 2, agree: 1 })
    expect(e.agreement.byType.score).toEqual({ compared: 2, agree: 1 })
    expect(e.agreement.byType.noul).toEqual({ compared: 2, agree: 1 })
    expect(e.agreement.disagreements).toHaveLength(3)
    expect(e.agreement.disagreements.every((d) => d.key === "b")).toBe(true)
  })

  it("reads decisiveness off every Jev answer, flat ones included", () => {
    expect(e.decisiveness.answers).toBe(9)
    // Flat: b's coin-flip choice (conf 0.1) and its 0.5 noul (zero distance).
    expect(e.decisiveness.undecidedShare).toBeCloseTo(2 / 9, 6)
    expect(e.decisiveness.meanConfidence).toBeCloseTo(6.08 / 9, 6)
    expect(e.decisiveness.baselineHasConfidence).toBe(false)
  })

  it("tracks how often the baseline parsed on its own", () => {
    expect(e.parse.baselineCalls).toBe(3)
    expect(e.parse.parseOk).toBe(2)
    expect(e.parse.parseOkRate).toBeCloseTo(2 / 3, 6)
  })
})

describe("aggregate / rollup", () => {
  const small: DemoInput = {
    slug: "small",
    title: "Small",
    kind: "single",
    group: "foundations",
    pairs: [
      {
        key: "only",
        jev: { answers: { q: { type: "noul", noul: 0.9 } }, usage: { input_tokens: 10, output_tokens: 5, cost: 0.0001 } },
        baseline: {
          answers: { q: { type: "noul", noul: 0.9 } },
          usage: { input_tokens: 20, output_tokens: 2, cost: 0.001 },
          parseOk: true,
        },
      },
    ],
  }

  const big = summariseDemo(demo)
  const tiny = summariseDemo(small)

  it("weights rates by their denominators, not by demo", () => {
    const row = aggregate("all", [big, tiny])
    expect(row.demos).toBe(2)
    expect(row.agreementRate).toBeCloseTo(4 / 7, 6) // (3+1) agree / (6+1) compared
    expect(row.parseOkRate).toBeCloseTo(3 / 4, 6) // (2+1) ok / (3+1) baseline calls
    expect(row.meanConfidence).toBeCloseTo(6.88 / 10, 6) // confidence weighted by answers
    expect(row.costRatio).toBeCloseTo(0.036 / 4 / (0.0041 / 4), 4)
  })

  it("groups in first-seen order", () => {
    const rows = rollup([big, tiny], (d) => d.group)
    expect(rows.map((r) => r.key)).toEqual(["foundations"])
    expect(rows[0]!.demos).toBe(2)
  })
})
