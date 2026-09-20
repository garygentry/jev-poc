import { describe, expect, it } from "vitest"

import { GUESSED_THRESHOLD, SAMPLES } from "./data"
import { bestThreshold, evaluate, sweep } from "./policy"

describe("evaluate", () => {
  it("counts the confusion matrix at a threshold", () => {
    const m = evaluate(SAMPLES, GUESSED_THRESHOLD)
    // At 0.5, every positive is caught but four distractors sneak in.
    expect(m.tp).toBe(10)
    expect(m.fn).toBe(0)
    expect(m.fp).toBe(4)
    expect(m.recall).toBeCloseTo(1)
  })

  it("admits everything at threshold 0 and nothing at threshold above 1", () => {
    const all = evaluate(SAMPLES, 0)
    expect(all.tp + all.fp).toBe(SAMPLES.length)
    const none = evaluate(SAMPLES, 1.01)
    expect(none.tp + none.fp).toBe(0)
    // Guarded, not NaN, at the empty edge.
    expect(none.precision).toBe(0)
  })
})

describe("sweep", () => {
  it("covers the grid from 0 to 1 inclusive", () => {
    const points = sweep(SAMPLES, 0.05)
    expect(points[0]?.threshold).toBe(0)
    expect(points[points.length - 1]?.threshold).toBeCloseTo(1)
    expect(points.length).toBe(21)
  })
})

describe("bestThreshold", () => {
  it("beats the guessed default on this labelled set", () => {
    const fitted = bestThreshold(SAMPLES)
    const guessed = evaluate(SAMPLES, GUESSED_THRESHOLD)
    expect(fitted.f1).toBeGreaterThan(guessed.f1)
  })

  it("fits higher than 0.5, cutting the false positives the guess admits", () => {
    const fitted = bestThreshold(SAMPLES)
    expect(fitted.threshold).toBeGreaterThan(GUESSED_THRESHOLD)
    expect(fitted.fp).toBeLessThan(evaluate(SAMPLES, GUESSED_THRESHOLD).fp)
  })
})
