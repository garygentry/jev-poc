import { describe, expect, it } from "vitest"

import { describeSpread, readPanel } from "./spread"

import type { BatchItemResult } from "@shared/jev.ts"

const reading = (id: string, wouldAct: number, lands?: number, confidence = 0.9) =>
  ({
    id,
    answers: {
      would_act: { type: "noul", noul: wouldAct },
      ...(lands === undefined
        ? {}
        : {
            lands: {
              type: "score",
              score: lands,
              confidence,
              probabilities: {},
            },
          }),
    },
  }) satisfies BatchItemResult

describe("readPanel", () => {
  it("skips rows with no usable noul", () => {
    expect(readPanel([{ id: "a", error: "boom" }])).toEqual([])
  })

  it("excludes a flat score rather than reading it as a midpoint", () => {
    const [row] = readPanel([reading("a", 0.8, 1.5, 0)])
    expect(row!.lands).toBeNull()
    expect(row!.wouldAct).toBe(0.8)
  })
})

describe("describeSpread", () => {
  it("returns null for an empty panel", () => {
    expect(describeSpread([])).toBeNull()
  })

  it("distinguishes a split panel from a lukewarm one with the same mean", () => {
    // This is the whole point of the demo. Both panels average 0.5; one is a
    // real disagreement worth acting on, the other is a message nobody cares
    // about, and the mean cannot tell them apart.
    const split = describeSpread(
      readPanel([
        reading("a", 0.95),
        reading("b", 0.93),
        reading("c", 0.9),
        reading("d", 0.1),
        reading("e", 0.07),
        reading("f", 0.05),
      ]),
    )!

    const lukewarm = describeSpread(
      readPanel(
        ["a", "b", "c", "d", "e", "f"].map((id) => reading(id, 0.5)),
      ),
    )!

    expect(split.mean).toBeCloseTo(lukewarm.mean, 2)
    expect(split.polarised).toBe(true)
    expect(lukewarm.polarised).toBe(false)
    expect(split.deviation).toBeGreaterThan(lukewarm.deviation)
  })

  it("does not call a single dissenter a polarised panel", () => {
    const spread = describeSpread(
      readPanel([
        reading("a", 0.9),
        reading("b", 0.88),
        reading("c", 0.85),
        reading("d", 0.05),
      ]),
    )!
    expect(spread.unmoved).toBe(1)
    expect(spread.polarised).toBe(false)
  })

  it("buckets every reader exactly once", () => {
    const spread = describeSpread(
      readPanel([
        reading("a", 0.95),
        reading("b", 0.5),
        reading("c", 0.05),
      ]),
    )!
    expect(spread.convinced + spread.undecided + spread.unmoved).toBe(3)
  })

  it("reports the observed range, not a confidence interval", () => {
    const spread = describeSpread(
      readPanel([reading("a", 0.2), reading("b", 0.4), reading("c", 0.9)]),
    )!
    expect(spread.min).toBe(0.2)
    expect(spread.max).toBe(0.9)
  })
})
