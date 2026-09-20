import { regexMatches, type Fn } from "./corpus"

/**
 * The probability at or above which a function is treated as a hit.
 *
 * A search should not return a maybe: a noul near the middle is the gate saying
 * it cannot tell, and folding those into the results would make the hit list
 * mean less. The [[threshold-fitter]] demo will later fit this against labelled
 * functions rather than setting it by hand.
 */
export const MATCH_THRESHOLD = 0.6

/** Whether a function's match probability clears the threshold. */
export const isMatch = (noul: number | null): boolean =>
  noul !== null && noul >= MATCH_THRESHOLD

export type Disagreement = "false-match" | "miss" | null

/** One function's two verdicts: what the gate found, and what the regex found. */
export interface Classified {
  fn: Fn
  /** Jev's match probability, or null if the function was not judged yet. */
  probability: number | null
  jev: boolean
  regex: boolean
  /**
   * How the regex differs from the gate: it flagged a non-match (`false-match`),
   * or it missed a match (`miss`). Null when they agree.
   */
  disagreement: Disagreement
}

export function classify(fn: Fn, probability: number | null): Classified {
  const jev = isMatch(probability)
  const regex = regexMatches(fn)
  const disagreement: Disagreement =
    jev === regex ? null : regex ? "false-match" : "miss"
  return { fn, probability, jev, regex, disagreement }
}
