import { describe, expect, it } from "vitest"

import { PASSAGES, QUERIES } from "./corpus"
import { boundsOf, hitsAt, keywordScore, rankWithBounds } from "./baseline"

describe("rankWithBounds", () => {
  it("gives an unambiguous ranking tight bounds", () => {
    const ranked = rankWithBounds([
      { id: "a", score: 3 },
      { id: "b", score: 2 },
      { id: "c", score: 1 },
    ])
    expect(ranked.map((row) => row.bounds)).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  })

  it("reports a tie as the full range it is consistent with", () => {
    // Six-way tie for first: every one of them is "somewhere in 1–6", and
    // claiming any of them is 4th would be reporting the sort, not the scorer.
    const ranked = rankWithBounds(
      ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, score: 1 })),
    )
    for (const row of ranked) expect(row.bounds).toEqual([1, 6])
  })

  it("places a tied group after everything that strictly beats it", () => {
    const ranked = rankWithBounds([
      { id: "a", score: 9 },
      { id: "b", score: 4 },
      { id: "c", score: 4 },
      { id: "d", score: 4 },
      { id: "e", score: 0 },
    ])
    expect(boundsOf(ranked, "a")).toEqual([1, 1])
    expect(boundsOf(ranked, "c")).toEqual([2, 4])
    expect(boundsOf(ranked, "e")).toEqual([5, 5])
  })

  it("counts a hit only when the whole tied group fits inside n", () => {
    const ranked = rankWithBounds([
      { id: "gold", score: 1 },
      { id: "other", score: 1 },
      { id: "third", score: 1 },
    ])
    // Could be 1st, could be 3rd. Top-1 is not established.
    expect(hitsAt(ranked, "gold", 1)).toEqual({ certain: false, possible: true })
    expect(hitsAt(ranked, "gold", 3)).toEqual({ certain: true, possible: true })
  })

  it("reports a missing id as neither certain nor possible", () => {
    const ranked = rankWithBounds([{ id: "a", score: 1 }])
    expect(hitsAt(ranked, "absent", 5)).toEqual({ certain: false, possible: false })
  })
})

describe("fixture integrity", () => {
  it("points every query at a passage that exists", () => {
    // A typo in a gold id would silently make the example unwinnable, and it
    // would look like a model failure rather than a fixture bug.
    const ids = new Set(PASSAGES.map((passage) => passage.id))
    for (const query of QUERIES) expect(ids.has(query.gold)).toBe(true)
  })

  it("has no duplicate passage ids", () => {
    expect(new Set(PASSAGES.map((p) => p.id)).size).toBe(PASSAGES.length)
  })
})

describe("keywordScore", () => {
  it("scores lexical overlap and ignores stopwords", () => {
    const passage = PASSAGES.find((p) => p.id === "p09")!
    expect(keywordScore("rate limits", passage)).toBeGreaterThan(0)
    expect(keywordScore("the and of", passage)).toBe(0)
  })

  it("expresses no opinion on a query that shares no content words", () => {
    // q6 is the case the demo is built around: the answer ("Exporting your
    // data") shares nothing with "moving to another provider". Word matching
    // has nothing to rank by, which is not the same as ranking it badly.
    const query = QUERIES.find((q) => q.id === "q6")!
    const gold = PASSAGES.find((p) => p.id === query.gold)!
    expect(keywordScore(query.text, gold)).toBe(0)
  })
})
