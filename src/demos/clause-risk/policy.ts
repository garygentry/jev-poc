import { isNoul } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

/** The four risk dimensions, in the order the matrix shows them. */
export const RISK_DIMENSIONS = [
  { key: "one_sided", label: "one-sided" },
  { key: "liability", label: "liability" },
  { key: "lock_in", label: "lock-in" },
  { key: "ip_or_data", label: "IP / data" },
] as const

export type RiskKey = (typeof RISK_DIMENSIONS)[number]["key"]

/**
 * The probability at which a risk dimension surfaces a clause for review.
 *
 * A clause should surface on a clear signal, not a maybe: the cost of surfacing
 * a benign clause is a few seconds of a reviewer's skim, but the point of the
 * demo is the opposite saving — keeping boilerplate quiet — so the bar sits
 * above a coin flip. The [[threshold-fitter]] demo will later fit it against
 * labelled clauses.
 */
export const SURFACE_THRESHOLD = 0.6

/** One clause's read on one dimension. */
export interface RiskCell {
  key: RiskKey
  label: string
  probability: number | null
  over: boolean
}

/** A clause's full assessment: its four cells, and whether it surfaces. */
export interface Assessment {
  cells: RiskCell[]
  /** True when any dimension clears the threshold. */
  surfaced: boolean
  /** The dimensions that tripped, for the summary. */
  flags: RiskCell[]
  /** The highest risk probability across dimensions, for ordering. */
  topRisk: number
}

/**
 * Assess one clause from its four risk nouls.
 *
 * A missing answer never surfaces a clause on its own — silence is not risk —
 * but it also does not clear one: the clause is judged on what came back.
 */
export function assess(answers: Record<string, JevAnswer> | undefined): Assessment {
  const cells: RiskCell[] = RISK_DIMENSIONS.map(({ key, label }) => {
    const answer = answers?.[key]
    const probability = answer && isNoul(answer) ? answer.noul : null
    return { key, label, probability, over: probability !== null && probability >= SURFACE_THRESHOLD }
  })
  const flags = cells.filter((c) => c.over)
  const topRisk = cells.reduce((max, c) => Math.max(max, c.probability ?? 0), 0)
  return { cells, surfaced: flags.length > 0, flags, topRisk }
}
