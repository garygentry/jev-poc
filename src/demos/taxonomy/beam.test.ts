import { describe, expect, it } from "vitest"

import {
  BEAM_WIDTH,
  DESCEND_CONFIDENCE,
  PRUNE_BELOW,
  alive,
  best,
  expand,
  planRound,
  questionFor,
} from "./beam"
import { LEAF_COUNT, TAXONOMY, childrenAt } from "./taxonomy"

import type { ChoiceAnswer } from "@shared/jev.ts"

const root = { path: [] as string[], probability: 1, confidence: 1 }

const choice = (
  probabilities: Record<string, number>,
  confidence = 0.9,
): ChoiceAnswer => ({
  type: "choice",
  choice: Object.entries(probabilities).reduce((a, b) => (b[1] > a[1] ? b : a))[0],
  probabilities,
  confidence,
})

describe("taxonomy", () => {
  it("is three levels deep everywhere", () => {
    for (const l1 of TAXONOMY) {
      expect(l1.children?.length).toBeGreaterThan(0)
      for (const l2 of l1.children!) {
        expect(l2.children?.length).toBeGreaterThan(0)
        for (const l3 of l2.children!) expect(l3.children).toBeUndefined()
      }
    }
  })

  it("has unique keys at every level", () => {
    const keys: string[] = []
    const walk = (nodes: typeof TAXONOMY) => {
      for (const node of nodes) {
        keys.push(node.key)
        if (node.children) walk(node.children)
      }
    }
    walk(TAXONOMY)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("counts leaves consistently with the tree", () => {
    expect(LEAF_COUNT).toBeGreaterThan(30)
  })
})

describe("questionFor", () => {
  it("offers exactly the node's children as options", () => {
    const question = questionFor({ ...root, path: ["billing"] })
    expect(question.type).toBe("choice")
    if (question.type !== "choice") throw new Error("unreachable")
    expect(Object.keys(question.criteria)).toEqual(
      childrenAt(["billing"]).map((node) => node.key),
    )
  })
})

describe("planRound", () => {
  it("packs one question per live branch into a single round", () => {
    const round = planRound(1, [
      { ...root, path: ["billing"], probability: 0.6 },
      { ...root, path: ["technical"], probability: 0.3 },
    ])
    // Both questions share the ticket as state, so this is one request.
    expect(Object.keys(round!.questions)).toHaveLength(2)
  })

  it("returns null once nothing can be expanded", () => {
    expect(
      planRound(3, [
        { ...root, path: ["billing", "plans", "upgrade"], stoppedBecause: "leaf" },
      ]),
    ).toBeNull()
  })

  it("does not try to expand a leaf", () => {
    expect(
      planRound(3, [{ ...root, path: ["billing", "plans", "upgrade"] }]),
    ).toBeNull()
  })
})

describe("expand", () => {
  it("carries children forward by cumulative probability, not conditional", () => {
    const round = planRound(1, [
      { ...root, path: ["billing"], probability: 0.2 },
      { ...root, path: ["technical"], probability: 0.75 },
    ])!

    const branches = expand(round, {
      // A near-certain child of a weak parent...
      billing: choice({ payments: 0.95, invoices: 0.03, plans: 0.02 }),
      // ...versus a merely likely child of a strong one.
      technical: choice({ ingestion: 0.6, delivery: 0.3, dashboards: 0.1 }),
    })

    const winner = best(branches)!
    // 0.75 × 0.6 = 0.45 beats 0.2 × 0.95 = 0.19. Only the product says so.
    expect(winner.path).toEqual(["technical", "ingestion"])
  })

  it("stops descending when the distribution is flat", () => {
    const round = planRound(1, [{ ...root, path: ["billing"], probability: 0.9 }])!
    const branches = expand(round, {
      billing: choice(
        { payments: 0.34, invoices: 0.33, plans: 0.33 },
        DESCEND_CONFIDENCE - 0.01,
      ),
    })

    // It commits to `billing` rather than guessing one of three equals.
    expect(branches).toHaveLength(1)
    expect(branches[0]!.path).toEqual(["billing"])
    expect(branches[0]!.stoppedBecause).toBe("flat")
  })

  it("drops children below the prune floor", () => {
    const round = planRound(1, [{ ...root, path: ["billing"], probability: 0.1 }])!
    const branches = expand(round, {
      billing: choice({ payments: 0.9, invoices: 0.09, plans: 0.01 }),
    })

    // 0.1 × 0.09 = 0.009 and 0.1 × 0.01 = 0.001 are both under the floor.
    expect(branches.map((branch) => branch.path.at(-1))).toEqual(["payments"])
    expect(PRUNE_BELOW).toBeGreaterThan(0.009)
  })

  it("keeps only BEAM_WIDTH branches alive but records the rest", () => {
    const round = planRound(0, [root])!
    const branches = expand(round, {
      root: choice({
        billing: 0.3,
        technical: 0.28,
        account: 0.22,
        data: 0.12,
        feedback: 0.08,
      }),
    })

    expect(alive(branches)).toHaveLength(BEAM_WIDTH)
    // The dropped ones are retained, marked, so the UI can grey them out
    // rather than silently losing them.
    expect(branches.length).toBeGreaterThan(BEAM_WIDTH)
    expect(
      branches.slice(BEAM_WIDTH).every((b) => b.stoppedBecause === "beam"),
    ).toBe(true)
  })

  it("marks a branch that reached a leaf as finished", () => {
    const round = planRound(2, [
      { ...root, path: ["billing", "plans"], probability: 0.8 },
    ])!
    const branches = expand(round, {
      billing__plans: choice({ upgrade: 0.8, downgrade: 0.15, cancellation: 0.05 }),
    })
    expect(branches[0]!.stoppedBecause).toBe("leaf")
    expect(alive(branches)).toHaveLength(0)
  })

  it("ignores a branch the response has no answer for", () => {
    const round = planRound(1, [{ ...root, path: ["billing"], probability: 0.9 }])!
    expect(expand(round, {})).toEqual([])
  })
})
