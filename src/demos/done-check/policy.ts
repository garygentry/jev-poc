import { isNoul } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"
import { percent } from "@/lib/format"

/**
 * The order the criteria are checked and shown in — the manifest's question
 * names, listed once so the policy, the matrix and the trace never drift.
 */
export const CRITERIA = [
  "meets_requirement",
  "real_implementation",
  "has_test",
  "tests_pass",
  "scoped",
] as const

export type Criterion = (typeof CRITERIA)[number]

/** A short human label for each criterion, for the matrix and the blockers. */
export const CRITERION_LABEL: Record<Criterion, string> = {
  meets_requirement: "meets the requirement",
  real_implementation: "real implementation, not a stub",
  has_test: "covered by a test",
  tests_pass: "tests pass",
  scoped: "scoped — nothing unrelated removed",
}

/**
 * A criterion is met only when Jev is clearly for it, not merely not against.
 *
 * The bar is set well above a coin flip on purpose, for the asymmetry a
 * done-check lives by: passing a task that is not actually done ships a bug into
 * main — a broken deploy, a stub in production, a green suite that tests
 * nothing — and the cost of that lands later and on someone else. Sending a
 * genuinely-finished task back for a second look costs a cheap re-read. So an
 * uncertain criterion (a noul near 0.5) blocks rather than passes: "done"
 * has to be earned, and the gate declines to certify what it cannot confirm.
 *
 * The [[threshold-fitter]] demo will later fit this number against labelled
 * "done" claims instead of setting it by hand.
 */
export const MET_THRESHOLD = 0.6

/** One criterion's verdict: the probability it was met, and whether it cleared. */
export interface CriterionVerdict {
  name: Criterion
  label: string
  /** Jev's probability the criterion is met, or null if it went unanswered. */
  probability: number | null
  met: boolean
}

export interface DoneCheck {
  /** True only when every criterion cleared the bar. */
  done: boolean
  criteria: CriterionVerdict[]
  /** The criteria that failed, in criterion order — what to fix before "done". */
  blockers: CriterionVerdict[]
  trace: PolicyLine[]
}

const probabilityOf = (answer: JevAnswer | undefined): number | null =>
  answer && isNoul(answer) ? answer.noul : null

/**
 * Turn five criterion probabilities into a single done/not-done verdict.
 *
 * A missing answer counts as *not met*, unlike the context pruner where a silent
 * gate keeps a chunk. The default is opposite here because the risk is opposite:
 * a criterion Jev never answered is one we cannot confirm, and confirming is the
 * whole job — an unconfirmed criterion must not certify "done".
 */
export function checkDone(answers: Record<string, JevAnswer>): DoneCheck {
  const trace: PolicyLine[] = []
  const line = (code: string, fired?: boolean, note?: string) =>
    trace.push({ code, fired, note })

  line("const MET = 0.6  // clearly met, not merely not-against")
  line("")
  line("const met = (c) => (answers[c]?.noul ?? 0) >= MET")

  const criteria: CriterionVerdict[] = CRITERIA.map((name) => {
    const probability = probabilityOf(answers[name])
    const met = probability !== null && probability >= MET_THRESHOLD
    return { name, label: CRITERION_LABEL[name], probability, met }
  })

  line("")
  for (const c of criteria) {
    line(
      `met('${c.name}')`,
      c.met,
      c.probability === null ? "—" : percent(c.probability, 0),
    )
  }

  const blockers = criteria.filter((c) => !c.met)
  const done = blockers.length === 0

  line("")
  line("return CRITERIA.every(met)", done, done ? "done" : `${blockers.length} blocking`)

  return { done, criteria, blockers, trace }
}
