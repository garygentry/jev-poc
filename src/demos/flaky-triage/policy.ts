import { isUndecided } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"
import { percent } from "@/lib/format"

/** What CI should do with the failure. */
export type Action = "retry" | "block" | "infra" | "human"

export const ACTION_LABEL: Record<Action, string> = {
  retry: "auto-retry",
  block: "block — real regression",
  infra: "re-run on a clean runner",
  human: "surface to an engineer",
}

/**
 * How sure "flaky" has to be before code retries on its own.
 *
 * High on purpose. The failure of an auto-retry is asymmetric and quiet: retry a
 * real regression and it fails again, an engineer shrugs and retries once more,
 * and eventually a run goes green by luck and ships the bug. A needless surface
 * to a human costs a minute; a wrongly-retried regression costs a release. So
 * "flaky" must be both the top category *and* held with real confidence.
 */
export const RETRY_CONFIDENCE = 0.7

/**
 * A flaky verdict is only safe to retry if the failure is *not* deterministic.
 *
 * A re-run only helps a nondeterministic failure; retrying something that would
 * fail identically just wastes minutes and, worse, invites the manual re-retry
 * that eventually masks it. So even a confident "flaky" is sent to a human when
 * the failure looks like it would reproduce.
 */
export const DETERMINISTIC_MAX = 0.4

/** A confident classification needs both the top category and enough confidence. */
export const CONFIDENT = 0.6

export interface Triage {
  action: Action
  reason: string
  trace: PolicyLine[]
}

/**
 * Turn a category and a determinism read into a CI action.
 *
 * The safe default is `human`: anything uncertain — a flat category, a low-
 * confidence flaky, a flaky that looks deterministic — is surfaced rather than
 * retried, because the only truly costly mistake here is an automatic green that
 * hides a regression.
 */
export function triageFailure(answers: Record<string, JevAnswer>): Triage {
  const category = answers.category
  if (category?.type !== "choice") {
    throw new Error("flaky-triage: `category` must be a choice answer")
  }
  const deterministic = answers.deterministic
  const detProb = deterministic?.type === "noul" ? deterministic.noul : null

  const trace: PolicyLine[] = []
  const line = (code: string, fired?: boolean, note?: string) =>
    trace.push({ code, fired, note })

  const flat = isUndecided(category)
  const confident = !flat && category.confidence >= CONFIDENT
  const pick = category.choice

  line("const RETRY_CONFIDENCE = 0.7, DETERMINISTIC_MAX = 0.4")
  line("")

  // A regression is the one class where being wrong is expensive, so it is
  // decided first and needs only ordinary confidence — err toward blocking.
  const isRegression = confident && pick === "regression"
  line("if (category == 'regression') return 'block'", isRegression, isRegression ? percent(category.confidence, 0) : undefined)
  if (isRegression) {
    return { action: "block", reason: "a real regression — fail the build and tell the author", trace }
  }

  const isInfra = confident && pick === "infra"
  line("if (category == 'infra') return 'infra'", isInfra, isInfra ? percent(category.confidence, 0) : undefined)
  if (isInfra) {
    return { action: "infra", reason: "the environment failed, not the code — re-run on a clean runner", trace }
  }

  line("")
  const flakyConfident = pick === "flaky" && !flat && category.confidence >= RETRY_CONFIDENCE
  const nondeterministic = detProb !== null && detProb < DETERMINISTIC_MAX
  const retry = flakyConfident && nondeterministic
  line(
    "if (flaky ≥ RETRY_CONFIDENCE && !deterministic) return 'retry'",
    retry,
    flakyConfident
      ? detProb !== null
        ? `det ${detProb.toFixed(2)}`
        : "det —"
      : pick === "flaky"
        ? percent(category.confidence, 0)
        : undefined,
  )
  if (retry) {
    return { action: "retry", reason: "a nondeterministic flake — safe to re-run once", trace }
  }

  line("")
  line("return 'human'", true, flat ? "flat category" : undefined)
  const reason = flat
    ? "the output does not say clearly enough — an engineer looks"
    : pick === "unclear"
      ? "the output does not say enough to classify — an engineer looks"
      : pick === "flaky"
        ? nondeterministic
          ? `flaky but only ${percent(category.confidence, 0)} sure — surfaced, not retried`
          : "reads flaky but would reproduce — not safe to auto-retry"
        : `not confidently classified (${pick}) — an engineer looks`
  return { action: "human", reason, trace }
}
