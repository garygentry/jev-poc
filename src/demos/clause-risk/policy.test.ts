import { describe, expect, it } from "vitest"

import { RISK_DIMENSIONS, SURFACE_THRESHOLD, assess } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

/** All dimensions low unless overridden. */
function answers(overrides: Record<string, number> = {}) {
  const base: Record<string, JevAnswer> = {}
  for (const { key } of RISK_DIMENSIONS) base[key] = noul(overrides[key] ?? 0.05)
  return base
}

describe("assess", () => {
  it("does not surface a clause whose every dimension is low", () => {
    const a = assess(answers())
    expect(a.surfaced).toBe(false)
    expect(a.flags).toHaveLength(0)
  })

  it("surfaces a clause when any dimension clears the threshold", () => {
    const a = assess(answers({ liability: 0.9 }))
    expect(a.surfaced).toBe(true)
    expect(a.flags.map((f) => f.key)).toEqual(["liability"])
  })

  it("flags every dimension that trips, in matrix order", () => {
    const a = assess(answers({ ip_or_data: 0.8, one_sided: 0.9 }))
    expect(a.flags.map((f) => f.key)).toEqual(["one_sided", "ip_or_data"])
  })

  it("uses the threshold as the surfacing boundary", () => {
    expect(assess(answers({ lock_in: SURFACE_THRESHOLD })).surfaced).toBe(true)
    expect(assess(answers({ lock_in: SURFACE_THRESHOLD - 0.01 })).surfaced).toBe(false)
  })

  it("always returns one cell per dimension", () => {
    expect(assess(answers()).cells).toHaveLength(RISK_DIMENSIONS.length)
  })

  it("treats a missing clause answer as no risk, not a surface", () => {
    const a = assess(undefined)
    expect(a.surfaced).toBe(false)
    expect(a.cells.every((c) => c.probability === null)).toBe(true)
  })

  it("reports the top risk across dimensions", () => {
    expect(assess(answers({ liability: 0.4, lock_in: 0.7 })).topRisk).toBeCloseTo(0.7)
  })
})
