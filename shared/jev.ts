/**
 * The Jev wire contract, shared verbatim by the browser and the Hono sidecar.
 *
 * Jev is a System One model: it does not generate text. You send `state` plus a
 * map of named `questions`, and every question is answered against that same
 * state, in parallel, in one request. Answers come back typed, with calibrated
 * probabilities, so there is no parsing step and no free-text-to-struct failure
 * mode.
 *
 * Verified against OpenRouter's decisions endpoint:
 *
 *     POST https://openrouter.ai/api/alpha/decisions
 *     {"model": "typesafe/jev-1.13", "state": {...}, "questions": {...}}
 *
 * Note that `/chat/completions` rejects this model outright — decision models
 * are served on their own path.
 */

/** Anything JSON-shaped. Jev accepts a bare string or a structured object. */
export type JevState = string | Record<string, unknown> | unknown[]

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/**
 * One of a fixed set of options.
 *
 * `criteria` maps each option key to a description of when it applies. Always
 * include a no-match option: the model cannot choose a value you never offered
 * it, so without one it is forced to pick among wrong answers.
 */
export interface ChoiceQuestion {
  type: "choice"
  instructions: string
  criteria: Record<string, string>
}

/**
 * A position along a dimension you define.
 *
 * `criteria` is an ordered list of levels, and **levels are 0-indexed** — three
 * criteria means levels 0, 1 and 2, so a returned score of 1.5 sits between the
 * middle and top level. Each level should describe a concrete situation rather
 * than an abstract degree ("a workaround exists", not "medium").
 */
export interface ScoreQuestion {
  type: "score"
  instructions: string
  criteria: string[]
}

/**
 * Whether a proposition holds, answered as a probability rather than a boolean.
 *
 * `criteria` is optional; supplying explicit `true`/`false` descriptions sharpens
 * the boundary when the proposition is at all ambiguous.
 */
export interface NoulQuestion {
  type: "noul"
  instructions: string
  criteria?: { true: string; false: string }
}

export type JevQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion

/** A named set of questions, all answered against one state in one request. */
export type JevQuestionSet = Record<string, JevQuestion>

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export interface ChoiceAnswer {
  type: "choice"
  /** The winning option key. */
  choice: string
  /** Full distribution over every option key, summing to ~1. */
  probabilities: Record<string, number>
  /** How concentrated that distribution is. See `isUndecided`. */
  confidence: number
}

export interface ScoreAnswer {
  type: "score"
  /** Probability-weighted mean level. Can land between levels. */
  score: number
  /**
   * Distribution over levels. Keys arrive as strings even though the levels are
   * integers — they only coerce in JSON mode, so do not assume numeric keys.
   */
  probabilities: Record<string, number>
  /** Level index to its criterion text, string-keyed for the same reason. */
  legend?: Record<string, string>
  confidence: number
}

export interface NoulAnswer {
  type: "noul"
  /** Probability the proposition holds, 0–1. There is no separate confidence. */
  noul: number
}

export type JevAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer

export interface JevUsage {
  input_tokens: number
  output_tokens: number
  /** Upstream-reported cost in USD. Output tokens are free. */
  cost: number
}

/** Exactly what the decisions endpoint returns. */
export interface SystemOneResponse {
  model: string
  answers: Record<string, JevAnswer>
  usage: JevUsage
  provider?: string
}

// ---------------------------------------------------------------------------
// Our own envelope
// ---------------------------------------------------------------------------

/**
 * The literal bytes either way, carried back to the browser so the UI can show
 * the real request and response rather than a reconstruction of them.
 */
export interface JevWire {
  request: unknown
  response: unknown
}

export interface DecideRequest {
  state: JevState
  questions: JevQuestionSet
  /**
   * Which seeded fixture to replay when no API key is configured. Ignored in
   * live mode.
   */
  fixtureKey?: string
}

/**
 * Where an answer came from, so the UI can never present replayed data as live.
 *
 * - `live` — the model answered.
 * - `seeded` — a hand-written fixture, committed so the app is explorable with
 *   no key. Plausible, but not a recording of a real response until
 *   `pnpm capture` overwrites it with one.
 * - `synthetic` — deterministically derived from a hash of the input, used only
 *   for wide fan-outs that would need hundreds of fixtures. It is shaped like a
 *   response and means nothing at all.
 */
export type AnswerSource = "live" | "seeded" | "synthetic"

export interface DecideResponse extends SystemOneResponse {
  /** Measured round trip, including transport. Never a stand-in value. */
  latencyMs: number
  /** True when this did not come from the live model. */
  replayed: boolean
  source: AnswerSource
  wire: JevWire
}

export interface BatchItem {
  id: string
  state: JevState
}

export interface BatchRequest {
  items: BatchItem[]
  /** One question set, evaluated against each item's state separately. */
  questions: JevQuestionSet
  fixtureKey?: string
  /** Clamped server-side by `MAX_CONCURRENCY`. */
  concurrency?: number
}

export interface BatchItemResult {
  id: string
  answers?: Record<string, JevAnswer>
  usage?: JevUsage
  latencyMs?: number
  error?: string
}

export interface BatchResponse {
  results: BatchItemResult[]
  /** Summed usage across every item that succeeded. */
  usage: JevUsage
  /** Wall-clock for the whole fan-out, which is not the sum of the parts. */
  wallClockMs: number
  replayed: boolean
  source: AnswerSource
}

export type ServerMode = "live" | "fixture"

export interface HealthResponse {
  mode: ServerMode
  model: string
  /** Cumulative spend for this server process, for the header meter. */
  spend: JevUsage & { calls: number }
}

// ---------------------------------------------------------------------------
// Reading answers
// ---------------------------------------------------------------------------

/**
 * OpenRouter's listed price for `typesafe/jev-1.13`, in USD per input token.
 * Output tokens are free.
 *
 * This is dated external data (read 2026-09-19) and will go stale. It is only
 * used to project hypothetical costs — every figure the UI reports for work it
 * actually did comes from `usage.cost` on a real response.
 */
export const JEV_USD_PER_INPUT_TOKEN = 0.042 / 1_000_000

/**
 * Whether the distribution is flat enough that the answer means nothing.
 *
 * A near-zero confidence is Jev saying it cannot distinguish between the
 * options, which is a different statement from a low-but-real answer. Acting
 * on the top option in that case is a mistake, so callers check this before
 * branching and the UI renders it as its own state.
 *
 * **The floor is calibrated against real output, and was wrong at first.** It
 * started at 0.05, which was tuned against hand-written fixtures. Live Jev
 * returned `0.09` for a three-level score distributed `0.38 / 0.40 / 0.22` —
 * the top two within two points of each other, which is about as undecided as
 * an answer gets, and it sailed over a 0.05 floor. Thresholds tuned against a
 * weaker or invented model do not transfer; this one is set where live
 * answers put it.
 *
 * Note what this is *not* for. A `0.34` on a genuine two-way contest (`0.51`
 * against `0.49`, the rest zero) is a decided answer held weakly, not a flat
 * one — that is what the per-branch confidence gates are for, and conflating
 * the two would throw away a real signal.
 */
export const UNDECIDED_FLOOR = 0.15

export function isUndecided(
  answer: ChoiceAnswer | ScoreAnswer,
  floor = UNDECIDED_FLOOR,
): boolean {
  return answer.confidence <= floor
}

/**
 * A Noul's distance from a coin flip, mapped onto 0–1 so it can be displayed
 * beside Choice and Score confidences.
 *
 * Derived here, not returned by the model: a Noul's probability already *is*
 * its answer, and 0.5 means genuine uncertainty rather than "half true".
 */
export function noulConfidence(answer: NoulAnswer): number {
  return Math.abs(answer.noul - 0.5) * 2
}

/** Distribution entries sorted by probability, highest first. */
export function rankedProbabilities(
  probabilities: Record<string, number>,
): Array<{ key: string; probability: number }> {
  return Object.entries(probabilities)
    .map(([key, probability]) => ({ key, probability }))
    .sort((a, b) => b.probability - a.probability)
}

export function isChoice(answer: JevAnswer): answer is ChoiceAnswer {
  return answer.type === "choice"
}

export function isScore(answer: JevAnswer): answer is ScoreAnswer {
  return answer.type === "score"
}

export function isNoul(answer: JevAnswer): answer is NoulAnswer {
  return answer.type === "noul"
}
