import { describe, expect, it } from "vitest"

import { KEEP_THRESHOLD, prune, type Judged } from "./policy"

const chunk = (id: string, tokens: number, relevance: number | null): Judged => ({
  id,
  tokens,
  relevance,
})

describe("prune", () => {
  it("keeps the relevant chunks and drops the rest, summing tokens each way", () => {
    const result = prune([
      chunk("a", 100, 0.9),
      chunk("b", 40, 0.1),
      chunk("c", 60, 0.8),
      chunk("d", 30, 0.2),
    ])

    expect(result.kept.map((c) => c.id)).toEqual(["a", "c"])
    expect(result.dropped.map((c) => c.id)).toEqual(["b", "d"])
    expect(result.keptTokens).toBe(160)
    expect(result.droppedTokens).toBe(70)
    expect(result.totalTokens).toBe(230)
    expect(result.keptCount).toBe(2)
    expect(result.droppedCount).toBe(2)
  })

  it("keeps a chunk exactly on the threshold", () => {
    // Keeping ties is the point of the asymmetry: a borderline chunk is left in.
    const result = prune([chunk("edge", 50, KEEP_THRESHOLD)])
    expect(result.kept.map((c) => c.id)).toEqual(["edge"])
  })

  it("keeps a chunk whose relevance the gate never answered", () => {
    // A missing judgement is not evidence against a chunk; the safe default is
    // to leave the context intact rather than silently shrink it.
    const result = prune([chunk("missing", 80, null), chunk("junk", 20, 0.05)])
    expect(result.kept.map((c) => c.id)).toEqual(["missing"])
    expect(result.dropped.map((c) => c.id)).toEqual(["junk"])
  })

  it("respects a threshold override, so a fitter can tune it later", () => {
    const judged = [chunk("a", 10, 0.4), chunk("b", 10, 0.6)]
    expect(prune(judged, 0.35).keptCount).toBe(2)
    expect(prune(judged, 0.7).keptCount).toBe(0)
  })

  it("handles an empty context without dividing by anything", () => {
    const result = prune([])
    expect(result.totalTokens).toBe(0)
    expect(result.keptCount).toBe(0)
    expect(result.droppedCount).toBe(0)
  })
})
