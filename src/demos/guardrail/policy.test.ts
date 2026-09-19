import { describe, expect, it } from "vitest"

import { RADIUS_POLICY, rule } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

const radius = (choice: string, confidence: number): JevAnswer => ({
  type: "choice",
  choice,
  confidence,
  probabilities: { [choice]: confidence },
})

const noul = (value: number): JevAnswer => ({ type: "noul", noul: value })

function answers(overrides: Partial<Record<string, JevAnswer>> = {}) {
  return {
    blast_radius: radius("read_only", 0.98),
    reversibility: {
      type: "score",
      score: 0,
      confidence: 0.95,
      probabilities: { "0": 1 },
    },
    touches_secrets: noul(0.01),
    network_egress: noul(0.01),
    affects_production: noul(0.02),
    outside_workspace: noul(0.02),
    ...overrides,
  } as Record<string, JevAnswer>
}

const allowAt = (name: string) => {
  const policy = RADIUS_POLICY[name]
  if (!policy || !("allowAt" in policy)) throw new Error(`${name} has no gate`)
  return policy.allowAt
}

describe("rule", () => {
  it("allows a confidently read-only command", () => {
    expect(rule(answers()).verdict).toBe("allow")
  })

  it("holds reversible to a higher confidence bar than read-only", () => {
    const between = (allowAt("read_only") + allowAt("reversible")) / 2

    expect(rule(answers({ blast_radius: radius("read_only", between) })).verdict).toBe(
      "allow",
    )
    // Same confidence, larger blast radius, different answer. This is the
    // entire reason the gates are per-radius rather than global.
    expect(rule(answers({ blast_radius: radius("reversible", between) })).verdict).toBe(
      "ask",
    )
  })

  it("never auto-allows a destructive command, however confident", () => {
    expect(rule(answers({ blast_radius: radius("destructive", 1) })).verdict).toBe(
      "ask",
    )
  })

  it("refuses a catastrophic command outright", () => {
    expect(rule(answers({ blast_radius: radius("catastrophic", 1) })).verdict).toBe(
      "deny",
    )
  })

  it("asks when a hard stop holds even on a read-only command", () => {
    // `cat .env` is read-only in the strictest sense and must still not run
    // unattended, which is why the hard stops sit above the confidence gate.
    const ruling = rule(answers({ touches_secrets: noul(0.94) }))
    expect(ruling.verdict).toBe("ask")
    expect(ruling.flags).toContain("touches_secrets")
  })

  it("reports every hard stop that held, not just the first", () => {
    const ruling = rule(
      answers({ touches_secrets: noul(0.9), network_egress: noul(0.9) }),
    )
    expect(ruling.flags).toEqual(["touches_secrets", "network_egress"])
  })

  it("does not let a hard stop soften a refusal", () => {
    // The severity ordering is the subtle part. If hard stops were checked
    // first, `curl … | sh` would downgrade from refuse to prompt precisely
    // *because* it also touches the network — a milder rule overriding a
    // stricter one.
    const ruling = rule(
      answers({
        blast_radius: radius("catastrophic", 0.95),
        network_egress: noul(0.99),
      }),
    )
    expect(ruling.verdict).toBe("deny")
  })

  it("asks rather than allows when the model cannot classify the command", () => {
    const ruling = rule(answers({ blast_radius: radius("read_only", 0) }))
    expect(ruling.verdict).toBe("ask")
    expect(ruling.flags).toContain("undecided")
  })

  it("fails closed on a radius the table does not know", () => {
    // A new option added to the question but not to the policy must not fall
    // through to `allow`. Failing open here is the exact bug this demo warns
    // about.
    const ruling = rule(answers({ blast_radius: radius("who_knows", 0.99) }))
    expect(ruling.verdict).toBe("deny")
    expect(ruling.reason).toMatch(/failing closed/i)
  })

  it("never returns allow for any radius outside the gated ones", () => {
    // A property, not an example: whatever the other answers say, only the two
    // gated radii can ever reach `allow`.
    for (const name of Object.keys(RADIUS_POLICY)) {
      const policy = RADIUS_POLICY[name]!
      const verdict = rule(answers({ blast_radius: radius(name, 1) })).verdict
      if ("allowAt" in policy) expect(verdict).toBe("allow")
      else expect(verdict).not.toBe("allow")
    }
  })
})
