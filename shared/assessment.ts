/**
 * The measured signals a Jev-vs-baseline assessment is allowed to rest on.
 *
 * Everything here is **pure** and computed from recorded data only — the Jev
 * fixtures and the baseline fixtures captured against the same states. It is the
 * evidence layer under `scripts/build-evidence.ts`, kept in `shared/` and unit
 * tested for the same reason `baseline.ts` is: the arithmetic that decides what a
 * report may claim is exactly the part worth pinning down before a model reads it.
 *
 * The one rule that outranks the rest, inherited from `baseline.ts`: **these
 * fixtures have no ground truth.** Nothing here scores a model as correct. It
 * reports cost, tokens, decisiveness, agreement and parse-reliability — signals
 * you can read straight off the recordings — and stops there. "Which model is
 * more accurate" is a question this evidence cannot answer, and the assessment
 * instructions forbid inventing one.
 */
import type { BaselineAnswer } from "./baseline.ts"
import { UNDECIDED_FLOOR, isUndecided, noulConfidence } from "./jev.ts"
import type { JevAnswer, JevUsage } from "./jev.ts"

/** The three answer kinds. */
type QuestionType = JevAnswer["type"]

// ---------------------------------------------------------------------------
// Inputs — one aligned pair per recorded call
// ---------------------------------------------------------------------------

/** The baseline side of one call, or the fact that it failed to parse. */
export interface BaselineSide {
  /** Null when the model's reply did not parse into the question set's shape. */
  answers: Record<string, BaselineAnswer> | null
  usage: JevUsage
  parseOk: boolean
}

/** Jev and the baseline on the same state, keyed the same in both fixtures. */
export interface EvidencePair {
  key: string
  jev: { answers: Record<string, JevAnswer>; usage: JevUsage }
  /** Null when no baseline was recorded for this key at all. */
  baseline: BaselineSide | null
}

/** Everything the summariser needs about one demo. */
export interface DemoInput {
  slug: string
  title: string
  kind: string
  group: string
  pairs: EvidencePair[]
}

// ---------------------------------------------------------------------------
// Per-demo metric shapes
// ---------------------------------------------------------------------------

export interface CostMetrics {
  jevCalls: number
  baselineCalls: number
  jevInputTokens: number
  jevOutputTokens: number
  jevCost: number
  baselineInputTokens: number
  baselineOutputTokens: number
  baselineCost: number
  jevCostPerCall: number | null
  baselineCostPerCall: number | null
  /** baseline ÷ Jev cost per call. Null when Jev cost is zero or absent. */
  costRatio: number | null
}

export interface DecisivenessMetrics {
  /** Jev answers seen across every recorded call. */
  answers: number
  /** Mean Jev confidence (a noul's is its distance from a coin flip). */
  meanConfidence: number | null
  /** Share of Jev answers flat enough to mean nothing (see `UNDECIDED_FLOOR`). */
  undecidedShare: number | null
  /**
   * The baseline emits a single token, never a distribution, so it carries no
   * confidence at all. That absence is a recorded structural fact, not zero.
   */
  baselineHasConfidence: false
}

export interface AgreementMetrics {
  /** Questions where both models answered, so a comparison was possible. */
  compared: number
  agree: number
  agreementRate: number | null
  byType: Record<QuestionType, { compared: number; agree: number }>
  /** Where the two landed differently — data, never a verdict. Capped for size. */
  disagreements: Array<{ key: string; name: string; jev: string; baseline: string }>
}

export interface ParseMetrics {
  baselineCalls: number
  parseOk: number
  /** How often the baseline's raw reply parsed into the asked shape on its own. */
  parseOkRate: number | null
}

export interface DemoEvidence {
  slug: string
  title: string
  kind: string
  group: string
  cost: CostMetrics
  decisiveness: DecisivenessMetrics
  agreement: AgreementMetrics
  parse: ParseMetrics
}

/** How many disagreements to keep per demo — enough to read, not the whole list. */
export const MAX_DISAGREEMENTS = 8

// ---------------------------------------------------------------------------
// Reading a single Jev answer
// ---------------------------------------------------------------------------

/** A Jev answer's confidence on one 0–1 scale, whatever its type. */
function jevConfidence(answer: JevAnswer): number {
  return answer.type === "noul" ? noulConfidence(answer) : answer.confidence
}

/** Whether a Jev answer is flat enough to carry no signal. */
function jevIsFlat(answer: JevAnswer): boolean {
  return answer.type === "noul"
    ? noulConfidence(answer) <= UNDECIDED_FLOOR
    : isUndecided(answer)
}

/**
 * Whether Jev and the baseline landed the same way — the loose test from
 * `baseline.ts`: same choice, same rounded level, same side of a coin flip.
 * Keyed off the answers themselves, not a question set, so a `rounds` demo whose
 * questions change each round still compares.
 */
function agreesWith(jev: JevAnswer, base: BaselineAnswer): boolean {
  if (jev.type === "choice" && base.type === "choice") return jev.choice === base.choice
  if (jev.type === "score" && base.type === "score") return Math.round(jev.score) === base.score
  if (jev.type === "noul" && base.type === "noul") return jev.noul >= 0.5 === base.noul >= 0.5
  return false
}

/** A Jev answer for display, using its own legend for a score's level text. */
function showJev(answer: JevAnswer): string {
  if (answer.type === "choice") return answer.choice
  if (answer.type === "noul") return answer.noul.toFixed(2)
  const level = Math.round(answer.score)
  const text = answer.legend?.[String(level)]
  return text ? `${answer.score.toFixed(2)} (${text})` : answer.score.toFixed(2)
}

/** A baseline answer for display, borrowing the Jev score's legend when present. */
function showBaseline(base: BaselineAnswer, jev: JevAnswer): string {
  if (base.type === "choice") return base.choice
  if (base.type === "noul") return base.noul.toFixed(2)
  const text = jev.type === "score" ? jev.legend?.[String(base.score)] : undefined
  return text ? `${base.score} (${text})` : String(base.score)
}

const ratio = (part: number, whole: number): number | null =>
  whole === 0 ? null : part / whole

const perCall = (total: number, calls: number): number | null =>
  calls === 0 ? null : total / calls

// ---------------------------------------------------------------------------
// The summariser
// ---------------------------------------------------------------------------

const emptyByType = (): Record<QuestionType, { compared: number; agree: number }> => ({
  choice: { compared: 0, agree: 0 },
  score: { compared: 0, agree: 0 },
  noul: { compared: 0, agree: 0 },
})

/** Reduce one demo's recorded pairs to the measured signals. */
export function summariseDemo(input: DemoInput): DemoEvidence {
  const { pairs } = input

  const cost: CostMetrics = {
    jevCalls: 0,
    baselineCalls: 0,
    jevInputTokens: 0,
    jevOutputTokens: 0,
    jevCost: 0,
    baselineInputTokens: 0,
    baselineOutputTokens: 0,
    baselineCost: 0,
    jevCostPerCall: null,
    baselineCostPerCall: null,
    costRatio: null,
  }

  let answerCount = 0
  let confidenceSum = 0
  let flatCount = 0

  const agree: AgreementMetrics = {
    compared: 0,
    agree: 0,
    agreementRate: null,
    byType: emptyByType(),
    disagreements: [],
  }

  const parse: ParseMetrics = { baselineCalls: 0, parseOk: 0, parseOkRate: null }

  for (const pair of pairs) {
    cost.jevCalls += 1
    cost.jevInputTokens += pair.jev.usage.input_tokens
    cost.jevOutputTokens += pair.jev.usage.output_tokens
    cost.jevCost += pair.jev.usage.cost

    for (const answer of Object.values(pair.jev.answers)) {
      answerCount += 1
      confidenceSum += jevConfidence(answer)
      if (jevIsFlat(answer)) flatCount += 1
    }

    if (!pair.baseline) continue

    cost.baselineCalls += 1
    cost.baselineInputTokens += pair.baseline.usage.input_tokens
    cost.baselineOutputTokens += pair.baseline.usage.output_tokens
    cost.baselineCost += pair.baseline.usage.cost

    parse.baselineCalls += 1
    if (pair.baseline.parseOk) parse.parseOk += 1

    const baselineAnswers = pair.baseline.answers
    if (!baselineAnswers) continue

    // Compare on the keys both sides actually answered, so a rounds demo's
    // per-round questions line up without a question set to key against.
    for (const [name, jevAnswer] of Object.entries(pair.jev.answers)) {
      const baseAnswer = baselineAnswers[name]
      if (!baseAnswer) continue

      const bucket = agree.byType[jevAnswer.type]
      agree.compared += 1
      bucket.compared += 1
      if (agreesWith(jevAnswer, baseAnswer)) {
        agree.agree += 1
        bucket.agree += 1
      } else if (agree.disagreements.length < MAX_DISAGREEMENTS) {
        agree.disagreements.push({
          key: pair.key,
          name,
          jev: showJev(jevAnswer),
          baseline: showBaseline(baseAnswer, jevAnswer),
        })
      }
    }
  }

  cost.jevCostPerCall = perCall(cost.jevCost, cost.jevCalls)
  cost.baselineCostPerCall = perCall(cost.baselineCost, cost.baselineCalls)
  cost.costRatio =
    cost.jevCostPerCall && cost.baselineCostPerCall
      ? cost.baselineCostPerCall / cost.jevCostPerCall
      : null

  agree.agreementRate = ratio(agree.agree, agree.compared)
  parse.parseOkRate = ratio(parse.parseOk, parse.baselineCalls)

  return {
    slug: input.slug,
    title: input.title,
    kind: input.kind,
    group: input.group,
    cost,
    decisiveness: {
      answers: answerCount,
      meanConfidence: perCall(confidenceSum, answerCount),
      undecidedShare: ratio(flatCount, answerCount),
      baselineHasConfidence: false,
    },
    agreement: agree,
    parse,
  }
}

// ---------------------------------------------------------------------------
// Rollups — the same signals, grouped by shape and by section
// ---------------------------------------------------------------------------

export interface Rollup {
  key: string
  demos: number
  jevCost: number
  baselineCost: number
  jevCostPerCall: number | null
  baselineCostPerCall: number | null
  costRatio: number | null
  /** Weighted by comparisons, so a big demo is not outvoted by a tiny one. */
  agreementRate: number | null
  meanConfidence: number | null
  parseOkRate: number | null
}

/** Fold a set of demos into one rollup row, weighting rates by their denominators. */
export function aggregate(key: string, demos: DemoEvidence[]): Rollup {
  let jevCost = 0
  let baselineCost = 0
  let jevCalls = 0
  let baselineCalls = 0
  let compared = 0
  let agree = 0
  let answers = 0
  let confidenceWeighted = 0
  let parseCalls = 0
  let parseOk = 0

  for (const demo of demos) {
    jevCost += demo.cost.jevCost
    baselineCost += demo.cost.baselineCost
    jevCalls += demo.cost.jevCalls
    baselineCalls += demo.cost.baselineCalls
    compared += demo.agreement.compared
    agree += demo.agreement.agree
    answers += demo.decisiveness.answers
    confidenceWeighted += (demo.decisiveness.meanConfidence ?? 0) * demo.decisiveness.answers
    parseCalls += demo.parse.baselineCalls
    parseOk += demo.parse.parseOk
  }

  const jevCostPerCall = perCall(jevCost, jevCalls)
  const baselineCostPerCall = perCall(baselineCost, baselineCalls)

  return {
    key,
    demos: demos.length,
    jevCost,
    baselineCost,
    jevCostPerCall,
    baselineCostPerCall,
    costRatio:
      jevCostPerCall && baselineCostPerCall ? baselineCostPerCall / jevCostPerCall : null,
    agreementRate: ratio(agree, compared),
    meanConfidence: perCall(confidenceWeighted, answers),
    parseOkRate: ratio(parseOk, parseCalls),
  }
}

/** Group demos by a field and roll each group up, in first-seen order. */
export function rollup(
  demos: DemoEvidence[],
  by: (demo: DemoEvidence) => string,
): Rollup[] {
  const order: string[] = []
  const groups = new Map<string, DemoEvidence[]>()
  for (const demo of demos) {
    const key = by(demo)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(demo)
  }
  return order.map((key) => aggregate(key, groups.get(key)!))
}
