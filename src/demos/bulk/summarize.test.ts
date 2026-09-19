import { describe, expect, it } from "vitest"

import { countNoul, meanScore, tally } from "./summarize"
import { REVIEW_BELOW } from "./questions"

import type { BatchItemResult } from "@shared/jev.ts"

const row = (
  id: string,
  choice: string,
  confidence: number,
): BatchItemResult => ({
  id,
  answers: {
    sentiment: {
      type: "choice",
      choice,
      confidence,
      probabilities: { [choice]: confidence },
    },
  },
})

describe("tally", () => {
  it("counts confident rows and queues the rest", () => {
    const result = tally(
      [
        row("a", "negative", 0.95),
        row("b", "negative", 0.88),
        row("c", "positive", 0.91),
        row("d", "neutral", REVIEW_BELOW - 0.01),
      ],
      "sentiment",
    )

    expect(result.counts).toEqual({ negative: 2, positive: 1 })
    expect(result.labelled).toBe(3)
    expect(result.review).toEqual(["d"])
  })

  it("keeps an unconfident row out of the histogram entirely", () => {
    // Not merely flagged — excluded. Counting it and *also* queuing it would
    // put a label the run does not stand behind into the reported totals.
    const result = tally([row("a", "positive", 0.2)], "sentiment")
    expect(result.counts).toEqual({})
    expect(result.labelled).toBe(0)
  })

  it("queues a flat distribution even above the confidence floor", () => {
    const result = tally([row("a", "positive", 0)], "sentiment")
    expect(result.review).toEqual(["a"])
  })

  it("queues failures rather than dropping them", () => {
    // A row that errored is not a row that was labelled; silently losing it
    // would make the totals disagree with the input size.
    const result = tally(
      [row("a", "negative", 0.9), { id: "b", error: "HTTP 520" }],
      "sentiment",
    )
    expect(result.failed).toBe(1)
    expect(result.review).toContain("b")
    expect(result.labelled + result.review.length).toBe(2)
  })

  it("queues a row whose answer is the wrong primitive", () => {
    const result = tally(
      [{ id: "a", answers: { sentiment: { type: "noul", noul: 0.9 } } }],
      "sentiment",
    )
    expect(result.failed).toBe(1)
  })
})

describe("meanScore", () => {
  it("averages only the rows it could read", () => {
    const results: BatchItemResult[] = [
      {
        id: "a",
        answers: {
          severity: { type: "score", score: 2, confidence: 0.9, probabilities: {} },
        },
      },
      {
        id: "b",
        answers: {
          severity: { type: "score", score: 1, confidence: 0.8, probabilities: {} },
        },
      },
      {
        id: "c",
        answers: {
          // Flat: excluded, not averaged in as a 1.5.
          severity: { type: "score", score: 1.5, confidence: 0, probabilities: {} },
        },
      },
    ]

    expect(meanScore(results, "severity")).toEqual({ mean: 1.5, counted: 2 })
  })

  it("returns null rather than zero when nothing was readable", () => {
    expect(meanScore([{ id: "a", error: "boom" }], "severity")).toBeNull()
  })
})

describe("countNoul", () => {
  it("counts only rows that carried the answer", () => {
    const results: BatchItemResult[] = [
      { id: "a", answers: { is_actionable: { type: "noul", noul: 0.9 } } },
      { id: "b", answers: { is_actionable: { type: "noul", noul: 0.2 } } },
      { id: "c", error: "boom" },
    ]
    expect(countNoul(results, "is_actionable")).toEqual({ held: 1, counted: 2 })
  })
})
