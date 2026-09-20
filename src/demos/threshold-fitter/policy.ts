import type { Sample } from "./data"

/** A confusion matrix and the rates derived from it, at one threshold. */
export interface Metrics {
  threshold: number
  tp: number
  fp: number
  tn: number
  fn: number
  precision: number
  recall: number
  f1: number
  accuracy: number
}

/**
 * Score the labelled set at one threshold: predict relevant when noul ≥ t.
 *
 * Precision and recall are guarded at their empty edges — no predicted positives
 * is precision 0, no actual positives is recall 0 — so the sweep never divides
 * by zero at the extremes where a threshold admits everything or nothing.
 */
export function evaluate(samples: Sample[], threshold: number): Metrics {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  for (const s of samples) {
    const predicted = s.noul >= threshold
    if (predicted && s.truth) tp += 1
    else if (predicted && !s.truth) fp += 1
    else if (!predicted && !s.truth) tn += 1
    else fn += 1
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  const accuracy = (tp + tn) / samples.length
  return { threshold, tp, fp, tn, fn, precision, recall, f1, accuracy }
}

/** The default grid step for the sweep — fine enough to place the peak, coarse enough to read. */
export const STEP = 0.05

/** Score every threshold on the grid from 0 to 1. */
export function sweep(samples: Sample[], step = STEP): Metrics[] {
  const points: Metrics[] = []
  for (let t = 0; t <= 1 + 1e-9; t += step) {
    points.push(evaluate(samples, Math.round(t * 1000) / 1000))
  }
  return points
}

/**
 * The threshold that maximises F1 over the grid.
 *
 * F1 rather than accuracy, because a labelled set is rarely balanced and
 * accuracy rewards a threshold that just predicts the majority class. On a tie,
 * the lower threshold wins — it keeps recall, which is the side a keep-or-drop
 * gate errs toward. This is the number every other demo should be fitting
 * instead of guessing.
 */
export function bestThreshold(samples: Sample[], step = STEP): Metrics {
  return sweep(samples, step).reduce((best, m) => (m.f1 > best.f1 ? m : best))
}
