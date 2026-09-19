import { isUndecided } from "@shared/jev.ts"
import type { BatchItemResult } from "@shared/jev.ts"

import { REVIEW_BELOW } from "./questions"

export interface Tally {
  /** Counts per option, for a named Choice question. */
  counts: Record<string, number>
  /** Rows whose confidence fell short, or that failed outright. */
  review: string[]
  /** Rows that came back usable. */
  labelled: number
  failed: number
}

/**
 * Turn a batch's results into a histogram plus a human-review queue.
 *
 * The queue is the actual product here. A labelling run that reports only its
 * histogram is hiding the rows it could not call, and those are exactly the
 * rows worth a person's time — confidence is a triage mechanism, not a
 * decoration on a chart.
 */
export function tally(results: BatchItemResult[], question: string): Tally {
  const counts: Record<string, number> = {}
  const review: string[] = []
  let labelled = 0
  let failed = 0

  for (const row of results) {
    if (row.error || !row.answers) {
      failed += 1
      review.push(row.id)
      continue
    }

    const answer = row.answers[question]
    if (answer?.type !== "choice") {
      failed += 1
      review.push(row.id)
      continue
    }

    // A flat distribution and a merely-weak one both mean "do not act on this",
    // so both land in the same queue.
    if (isUndecided(answer) || answer.confidence < REVIEW_BELOW) {
      review.push(row.id)
      continue
    }

    counts[answer.choice] = (counts[answer.choice] ?? 0) + 1
    labelled += 1
  }

  return { counts, review, labelled, failed }
}

/** Mean of a Score across rows that were confident enough to count. */
export function meanScore(
  results: BatchItemResult[],
  question: string,
): { mean: number; counted: number } | null {
  let total = 0
  let counted = 0

  for (const row of results) {
    const answer = row.answers?.[question]
    if (answer?.type !== "score" || isUndecided(answer)) continue
    total += answer.score
    counted += 1
  }

  return counted === 0 ? null : { mean: total / counted, counted }
}

/**
 * Every row that at least one of `questions` could not call.
 *
 * The queue has to span the whole question set, not one of them. Live Jev
 * labelled all 60 rows of the sample corpus by sentiment and only 44 by theme —
 * a per-question queue therefore reported "0 rows need review" while sixteen
 * rows carried a theme nobody should act on.
 */
export function reviewQueue(
  results: BatchItemResult[],
  questions: string[],
): string[] {
  const queued = new Set<string>()
  for (const question of questions) {
    for (const id of tally(results, question).review) queued.add(id)
  }
  // Input order, so the queue reads the same way the corpus does.
  return results.map((row) => row.id).filter((id) => queued.has(id))
}

/** Rows where a Noul crossed `threshold`. */
export function countNoul(
  results: BatchItemResult[],
  question: string,
  threshold = 0.6,
): { held: number; counted: number } {
  let held = 0
  let counted = 0

  for (const row of results) {
    const answer = row.answers?.[question]
    if (answer?.type !== "noul") continue
    counted += 1
    if (answer.noul > threshold) held += 1
  }

  return { held, counted }
}
