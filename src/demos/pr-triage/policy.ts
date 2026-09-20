import { isUndecided } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"

/** The three tiers a PR can land in. */
export type Level = "auto" | "glance" | "review"

export const LEVEL_LABEL: Record<Level, string> = {
  auto: "merge without review",
  glance: "a quick human glance",
  review: "careful review required",
}

const RANK: Record<Level, number> = { auto: 0, glance: 1, review: 2 }
const atLeast = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b)

/** A noul above this is treated as holding; below, as not. */
export const LIKELY = 0.6

/**
 * A shared path is worth a human even when everything else looks fine.
 *
 * The score runs 0 (contained) to 2 (a shared path many requests hit); 1.5 sits
 * between a feature area and a shared path, so a change reaching a common
 * dependency clears it and a change to one flow does not.
 */
export const HIGH_BLAST = 1.5

/** Between contained and a feature area — enough blast that an untested change earns a look. */
export const MODERATE_BLAST = 0.75

export interface Triage {
  level: Level
  /** True when a person must look before it merges — any tier above auto. */
  human: boolean
  reasons: string[]
  trace: PolicyLine[]
}

/**
 * Turn five risk reads into a review tier.
 *
 * Every rule can only *raise* the tier, never lower it, so the order they run in
 * cannot change the verdict — the property that makes the policy safe to extend.
 * The asymmetry behind every threshold is the same: a needless review costs a
 * reviewer a minute, while a missed one ships a broken auth path or a dropped
 * column, so the gate escalates on doubt and reserves `auto` for changes that
 * are contained, reversible, and clearly not security.
 */
export function triage(answers: Record<string, JevAnswer>): Triage {
  const area = answers.area
  const blast = answers.blast_radius
  if (area?.type !== "choice") throw new Error("pr-triage: `area` must be a choice answer")
  if (blast?.type !== "score") throw new Error("pr-triage: `blast_radius` must be a score answer")

  const reasons: string[] = []
  const trace: PolicyLine[] = []
  const line = (code: string, fired?: boolean, note?: string) =>
    trace.push({ code, fired, note })

  const security = answers.security_sensitive
  const reversible = answers.reversible
  const tests = answers.has_tests

  const isSecurity = security?.type === "noul" && security.noul > LIKELY
  // Reversibility and tests are asked as "yes" propositions, so their *absence*
  // is what escalates — and an unanswered or uncertain read counts against the
  // change, because the safe default is the one that asks for eyes.
  const irreversible = reversible?.type === "noul" && reversible.noul < 0.5
  const untested = !(tests?.type === "noul" && tests.noul >= 0.5)
  const blastKnown = !isUndecided(blast)

  line("let level = 'auto'")
  line("")

  line("if (security_sensitive) level = 'review'", isSecurity, security?.type === "noul" ? security.noul.toFixed(2) : undefined)
  let level: Level = "auto"
  if (isSecurity) {
    level = atLeast(level, "review")
    reasons.push("touches security — a human must see it")
  }

  line("if (!reversible) level = 'review'", irreversible, reversible?.type === "noul" ? reversible.noul.toFixed(2) : undefined)
  if (irreversible) {
    level = atLeast(level, "review")
    reasons.push("hard to undo — not a plain revert")
  }

  line("")
  const highBlast = blastKnown && blast.score >= HIGH_BLAST
  line("if (blast >= HIGH_BLAST) level = untested ? 'review' : 'glance'", highBlast, highBlast ? blast.score.toFixed(2) : undefined)
  if (highBlast) {
    level = atLeast(level, untested ? "review" : "glance")
    reasons.push(
      untested
        ? "wide blast radius and untested"
        : "wide blast radius — worth a glance",
    )
  }

  const moderateUntested = blastKnown && blast.score >= MODERATE_BLAST && untested
  line("if (blast >= MODERATE_BLAST && untested) level = 'glance'", moderateUntested, moderateUntested ? blast.score.toFixed(2) : undefined)
  if (moderateUntested) {
    level = atLeast(level, "glance")
    if (!highBlast) reasons.push("changes a shared thing without a test")
  }

  line("")
  line(`return '${level}'`, true, LEVEL_LABEL[level])

  if (reasons.length === 0) reasons.push("contained, reversible, and not security")

  return { level, human: level !== "auto", reasons, trace }
}
