import { describe, expect, it } from "vitest"

import { MAX_ITERATIONS, STREAK, detectLoop } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

/** Build windows from a list of stuck-probabilities, numbered from step 1. */
const windows = (probs: Array<number | null>) =>
  probs.map((p, i) => ({
    startStep: i + 1,
    answer: p === null ? undefined : noul(p),
  }))

describe("detectLoop", () => {
  it("flags a sustained run of stuck windows at its onset", () => {
    // Progress, then a streak from the 4th window (step 4).
    const report = detectLoop(
      windows([0.1, 0.2, 0.3, 0.9, 0.92, 0.95, 0.9]),
      9,
    )
    expect(report.looping).toBe(true)
    expect(report.onsetStep).toBe(4)
  })

  it("does not flag a single stuck window — a stall is not a loop", () => {
    // One high window between progressing ones: below the streak, so no loop.
    const report = detectLoop(windows([0.1, 0.9, 0.2, 0.15]), 6)
    expect(report.looping).toBe(false)
    expect(report.onsetStep).toBeNull()
  })

  it("needs a run of STREAK, so a two-window stall that recovers is spared", () => {
    // Two stuck windows then a break — like `recovers`. Below the streak, so
    // the detector lets it run rather than cutting it like the counter would.
    expect(STREAK).toBe(3)
    expect(detectLoop(windows([0.9, 0.9, 0.2, 0.1]), 6).looping).toBe(false)
    // One more consecutive stuck window tips it into a loop.
    expect(detectLoop(windows([0.9, 0.9, 0.9, 0.1]), 6).looping).toBe(true)
  })

  it("prices the saving against the counter when a loop burns toward the cap", () => {
    // Onset at step 2, cap at 10 → the counter burns 8 steps the detector spares.
    const report = detectLoop(
      windows([0.2, 0.9, 0.92, 0.95, 0.9, 0.93, 0.94, 0.9, 0.92, 0.95]),
      12,
    )
    expect(report.onsetStep).toBe(2)
    expect(report.counterEnd).toBe(MAX_ITERATIONS)
    expect(report.stepsSaved).toBe(MAX_ITERATIONS - 2)
    expect(report.falseCut).toBe(false)
  })

  it("names a false cut: the counter stops a run that never looped", () => {
    // Twelve progressing windows, no streak — but the counter cuts at 10 anyway.
    const report = detectLoop(
      windows(Array.from({ length: 12 }, () => 0.1)),
      13,
    )
    expect(report.looping).toBe(false)
    expect(report.falseCut).toBe(true)
    expect(report.stepsSaved).toBe(0)
  })

  it("agrees with the counter when a short run finishes on its own", () => {
    const report = detectLoop(windows([0.1, 0.2, 0.15, 0.1]), 6)
    expect(report.looping).toBe(false)
    expect(report.falseCut).toBe(false)
  })

  it("treats an unanswered window as not stuck", () => {
    // A gap splits what would otherwise be a five-window streak into 2 + 2 —
    // silence never invents a stop.
    const report = detectLoop(windows([0.9, 0.9, null, 0.9, 0.9]), 7)
    expect(report.looping).toBe(false)
    const gap = report.windows[2]
    expect(gap?.probability).toBeNull()
    expect(gap?.stuck).toBe(false)
  })
})
