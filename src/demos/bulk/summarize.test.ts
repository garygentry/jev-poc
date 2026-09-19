import { describe, expect, it } from "vitest"

import { countNoul, meanScore, reviewQueue, tally } from "./summarize"
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

describe("reviewQueue", () => {
  const twoLabels = (
    id: string,
    sentiment: number,
    theme: number,
  ): BatchItemResult => ({
    id,
    answers: {
      sentiment: {
        type: "choice",
        choice: "negative",
        confidence: sentiment,
        probabilities: { negative: sentiment },
      },
      theme: {
        type: "choice",
        choice: "reliability",
        confidence: theme,
        probabilities: { reliability: theme },
      },
    },
  })

  it("queues a row that any single label could not call", () => {
    // The case that prompted this: live Jev labelled every row by sentiment
    // and only some of them by theme. A queue built from one question reported
    // nothing to review while rows carried a theme nobody should act on.
    const results = [
      twoLabels("a", 0.95, 0.95),
      twoLabels("b", 0.95, 0.2),
      twoLabels("c", 0.2, 0.95),
    ]

    expect(tally(results, "sentiment").review).toEqual(["c"])
    expect(tally(results, "theme").review).toEqual(["b"])
    expect(reviewQueue(results, ["sentiment", "theme"])).toEqual(["b", "c"])
  })

  it("lists a row once however many labels failed on it", () => {
    const results = [twoLabels("a", 0.1, 0.1)]
    expect(reviewQueue(results, ["sentiment", "theme"])).toEqual(["a"])
  })

  it("preserves input order rather than question order", () => {
    const results = [
      twoLabels("a", 0.95, 0.1),
      twoLabels("b", 0.1, 0.95),
      twoLabels("c", 0.95, 0.95),
    ]
    expect(reviewQueue(results, ["sentiment", "theme"])).toEqual(["a", "b"])
  })

  it("is empty when every label cleared", () => {
    expect(reviewQueue([twoLabels("a", 0.9, 0.9)], ["sentiment", "theme"])).toEqual(
      [],
    )
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
