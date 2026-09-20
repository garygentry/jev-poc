import { describe, expect, it } from "vitest"

import { CRITERIA, MET_THRESHOLD, checkDone } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

/** All five criteria clearly met, before a case overrides one to fail it. */
function answers(overrides: Partial<Record<string, JevAnswer>> = {}) {
  return {
    meets_requirement: noul(0.95),
    real_implementation: noul(0.95),
    has_test: noul(0.95),
    tests_pass: noul(0.98),
    scoped: noul(0.95),
    ...overrides,
  } as Record<string, JevAnswer>
}

describe("checkDone", () => {
  it("passes when every criterion is clearly met", () => {
    const check = checkDone(answers())
    expect(check.done).toBe(true)
    expect(check.blockers).toHaveLength(0)
  })

  it("blocks on a single failing criterion and names it", () => {
    const check = checkDone(answers({ tests_pass: noul(0.03) }))
    expect(check.done).toBe(false)
    expect(check.blockers.map((b) => b.name)).toEqual(["tests_pass"])
  })

  it("treats an uncertain criterion as not met — 'done' must be earned", () => {
    // A noul at a coin flip is Jev unable to confirm; confirming is the job, so
    // it blocks rather than certifying.
    const check = checkDone(answers({ has_test: noul(0.5) }))
    expect(check.done).toBe(false)
    expect(check.blockers.map((b) => b.name)).toEqual(["has_test"])
  })

  it("passes a criterion exactly at the threshold", () => {
    expect(checkDone(answers({ scoped: noul(MET_THRESHOLD) })).done).toBe(true)
  })

  it("counts a missing answer as not met", () => {
    // Unlike the pruner, silence blocks here: an unconfirmed criterion cannot
    // certify done.
    const check = checkDone(answers({ meets_requirement: undefined }))
    expect(check.done).toBe(false)
    const requirement = check.criteria.find((c) => c.name === "meets_requirement")
    expect(requirement?.probability).toBeNull()
    expect(requirement?.met).toBe(false)
  })

  it("reports every failing criterion when several fall short", () => {
    const check = checkDone(
      answers({ real_implementation: noul(0.1), has_test: noul(0.2) }),
    )
    expect(check.blockers.map((b) => b.name)).toEqual([
      "real_implementation",
      "has_test",
    ])
  })

  it("keeps the criteria in a stable order for the matrix", () => {
    expect(checkDone(answers()).criteria.map((c) => c.name)).toEqual([...CRITERIA])
  })
})
