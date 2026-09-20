import { describe, expect, it } from "vitest"

import { HIGH_BLAST, MODERATE_BLAST, triage } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const choice = (pick: string, confidence = 0.9): JevAnswer => ({
  type: "choice",
  choice: pick,
  confidence,
  probabilities: { [pick]: confidence },
})
const score = (value: number, confidence = 0.8): JevAnswer => ({
  type: "score",
  score: value,
  confidence,
  probabilities: { [String(Math.round(value))]: confidence },
})
const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

/** A safe change by default: contained, reversible, tested, not security. */
function answers(overrides: Partial<Record<string, JevAnswer>> = {}) {
  return {
    area: choice("docs_tests"),
    blast_radius: score(0),
    reversible: noul(0.95),
    has_tests: noul(0.9),
    security_sensitive: noul(0.03),
    ...overrides,
  } as Record<string, JevAnswer>
}

describe("triage", () => {
  it("auto-merges a contained, reversible, tested change", () => {
    const t = triage(answers())
    expect(t.level).toBe("auto")
    expect(t.human).toBe(false)
  })

  it("sends any security-touching change to review, even small and tested", () => {
    const t = triage(
      answers({ area: choice("security"), blast_radius: score(0.5), security_sensitive: noul(0.9) }),
    )
    expect(t.level).toBe("review")
    expect(t.reasons.join(" ")).toMatch(/security/)
  })

  it("sends an irreversible change to review", () => {
    const t = triage(answers({ area: choice("data"), reversible: noul(0.1) }))
    expect(t.level).toBe("review")
    expect(t.reasons.join(" ")).toMatch(/undo/)
  })

  it("reviews a wide-blast change that is untested", () => {
    const t = triage(answers({ blast_radius: score(2), has_tests: noul(0.1) }))
    expect(t.level).toBe("review")
  })

  it("only glances at a wide-blast change that is tested", () => {
    const t = triage(answers({ blast_radius: score(2), has_tests: noul(0.95) }))
    expect(t.level).toBe("glance")
  })

  it("glances at a moderately risky change shipped without a test", () => {
    const t = triage(answers({ blast_radius: score(MODERATE_BLAST + 0.1), has_tests: noul(0.1) }))
    expect(t.level).toBe("glance")
  })

  it("never lowers a tier once a rule has raised it", () => {
    // Security forces review; a low blast score must not pull it back to glance.
    const t = triage(
      answers({ security_sensitive: noul(0.95), blast_radius: score(0), has_tests: noul(0.95) }),
    )
    expect(t.level).toBe("review")
  })

  it("treats an unanswered tests read as untested", () => {
    // Missing coverage on a wide-blast change escalates — silence is not a pass.
    const t = triage(answers({ blast_radius: score(HIGH_BLAST), has_tests: undefined }))
    expect(t.level).toBe("review")
  })

  it("rejects an answer set whose primitives do not match the questions", () => {
    expect(() => triage(answers({ area: noul(0.5) }))).toThrow(/choice/)
  })
})
