import type { BatchItemResult } from "@shared/jev.ts"

export interface Reading {
  id: string
  wouldAct: number
  lands: number | null
}

export function readPanel(results: BatchItemResult[]): Reading[] {
  const readings: Reading[] = []

  for (const row of results) {
    const act = row.answers?.would_act
    if (act?.type !== "noul") continue
    const score = row.answers?.lands
    readings.push({
      id: row.id,
      wouldAct: act.noul,
      // A flat score is excluded rather than read as its midpoint.
      lands:
        score?.type === "score" && score.confidence > 0.05 ? score.score : null,
    })
  }

  return readings
}

export interface Spread {
  mean: number
  min: number
  max: number
  /** Population standard deviation across the panel. */
  deviation: number
  /** Readers above 0.6 and below 0.4 — the two ends that actually differ. */
  convinced: number
  unmoved: number
  undecided: number
  /** True when the panel is genuinely split rather than uniformly lukewarm. */
  polarised: boolean
}

/**
 * Describe the panel as a distribution, not as an average.
 *
 * The mean is the least informative number here and is reported alongside the
 * spread precisely so it cannot stand alone: a message that half the panel
 * loves and half ignores has the same mean as one that leaves everybody mildly
 * interested, and those call for opposite edits.
 *
 * `polarised` marks the first case — mass at both ends rather than piled in the
 * middle — which is the finding a single score would hide.
 */
export function describeSpread(readings: Reading[]): Spread | null {
  if (readings.length === 0) return null

  const values = readings.map((reading) => reading.wouldAct)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length

  const convinced = values.filter((value) => value > 0.6).length
  const unmoved = values.filter((value) => value < 0.4).length

  return {
    mean,
    min: Math.min(...values),
    max: Math.max(...values),
    deviation: Math.sqrt(variance),
    convinced,
    unmoved,
    undecided: values.length - convinced - unmoved,
    // Both ends populated, and neither is a lone outlier.
    polarised: convinced >= 2 && unmoved >= 2,
  }
}
