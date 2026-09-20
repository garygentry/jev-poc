/**
 * The measured-baseline harness: ask an ordinary chat model for the same
 * structured answer a Jev question set produces, so a demo can show a
 * head-to-head that is measured on both sides rather than projected on one.
 *
 * Everything in this file is pure and shared by the browser, the sidecar and
 * the capture script. The chat *call* itself goes over `POST /api/chat`; this
 * module only derives what to send and parses what comes back, which is exactly
 * the part worth unit-testing against the committed fixtures before any demo is
 * built on it.
 *
 * The one rule that outranks the rest: **these fixtures have no ground truth**,
 * so nothing here scores a model as correct. `compare` reports where the two
 * models differ as data and stops there.
 */
import type {
  ChoiceAnswer,
  JevAnswer,
  JevQuestion,
  JevQuestionSet,
  JevState,
  JevUsage,
  ScoreAnswer,
} from "./jev.ts"

// ---------------------------------------------------------------------------
// The baseline answer — a single value, not a distribution
// ---------------------------------------------------------------------------

/**
 * What a chat model returns per question: the answer flattened to one value.
 *
 * A chat model emits a token, not a calibrated distribution, so a baseline
 * answer carries no `probabilities` and no `confidence`. That absence is the
 * point of the comparison, and pretending otherwise — deriving a fake spread —
 * would invent the very thing Jev provides and the baseline does not.
 */
export interface BaselineChoice {
  type: "choice"
  choice: string
}
export interface BaselineScore {
  type: "score"
  score: number
}
export interface BaselineNoul {
  type: "noul"
  noul: number
}
export type BaselineAnswer = BaselineChoice | BaselineScore | BaselineNoul

// ---------------------------------------------------------------------------
// Schema derivation — the question set becomes a JSON schema
// ---------------------------------------------------------------------------

/** A JSON-schema fragment. Loosely typed on purpose; it is a wire payload. */
export type JsonSchemaNode = Record<string, unknown>

/** The `json_schema` payload OpenRouter's structured-output mode expects. */
export interface StructuredSchema {
  name: string
  strict: true
  schema: JsonSchemaNode
}

/** The number of levels a score question defines (levels are 0-indexed). */
const levelCount = (question: Extract<JevQuestion, { type: "score" }>) =>
  question.criteria.length

/**
 * Turn one question into its schema node.
 *
 * The mapping is the whole harness in miniature: a choice is one of a fixed
 * set, so it becomes an `enum`; a score is a level, so it becomes a bounded
 * `integer`; a noul is a probability, so it becomes a `number` on 0–1. The
 * instructions ride along as the description so the model sees the same guidance
 * the question set gives Jev.
 */
function nodeFor(question: JevQuestion): JsonSchemaNode {
  switch (question.type) {
    case "choice":
      return {
        type: "string",
        enum: Object.keys(question.criteria),
        description: question.instructions,
      }
    case "score":
      return {
        type: "integer",
        minimum: 0,
        maximum: levelCount(question) - 1,
        description:
          `${question.instructions} Answer with the 0-indexed level: ` +
          question.criteria.map((text, level) => `${level} = ${text}`).join("; "),
      }
    case "noul":
      return {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: `${question.instructions} Answer with a probability from 0 to 1.`,
      }
  }
}

/**
 * Derive one strict JSON schema for the whole question set.
 *
 * Strict mode requires every property to be listed in `required` and forbids
 * extras, which is what makes the returned object safe to read without a parse
 * step of its own — the same guarantee the question set gives on the Jev side.
 */
export function schemaFor(
  questions: JevQuestionSet,
  name = "baseline",
): StructuredSchema {
  const properties: Record<string, JsonSchemaNode> = {}
  for (const [key, question] of Object.entries(questions)) {
    properties[key] = nodeFor(question)
  }
  return {
    name,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(questions),
      properties,
    },
  }
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

/** The two halves of a chat request, ready to hand to `POST /api/chat`. */
export interface BaselinePrompt {
  system: string
  user: string
}

const SYSTEM =
  "You are a careful classifier. Read the state, then answer every field of " +
  "the requested JSON object. A score field is a 0-indexed level; a noul field " +
  "is a probability from 0 to 1. Answer only with the structured object."

/** One question rendered for the prompt, criteria and all. */
function describe(name: string, question: JevQuestion): string {
  const head = `- ${name}: ${question.instructions}`
  if (question.type === "choice") {
    const options = Object.entries(question.criteria)
      .map(([key, text]) => `    ${key} — ${text}`)
      .join("\n")
    return `${head}\n  One of:\n${options}`
  }
  if (question.type === "score") {
    const levels = question.criteria
      .map((text, level) => `    ${level} — ${text}`)
      .join("\n")
    return `${head}\n  Levels:\n${levels}`
  }
  if (question.criteria) {
    return `${head}\n    true — ${question.criteria.true}\n    false — ${question.criteria.false}`
  }
  return head
}

/**
 * Build the chat prompt for one state and question set.
 *
 * Deliberately *not* token-identical to what Jev receives — a prose prompt is
 * more verbose than a structured question set, and it cannot be otherwise. Any
 * card that shows the comparison has to say so rather than implying a controlled
 * experiment.
 */
export function promptFor(
  state: JevState,
  questions: JevQuestionSet,
): BaselinePrompt {
  const stateText =
    typeof state === "string" ? state : JSON.stringify(state, null, 2)
  const asked = Object.entries(questions)
    .map(([name, question]) => describe(name, question))
    .join("\n")
  return {
    system: SYSTEM,
    user: `State:\n${stateText}\n\nAnswer these questions:\n${asked}`,
  }
}

// ---------------------------------------------------------------------------
// Parsing what the model returned
// ---------------------------------------------------------------------------

/** A baseline response that did not match the schema it was asked for. */
export class BaselineParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BaselineParseError"
  }
}

const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value))

/**
 * Coerce the model's object into one comparable to a Jev answer set.
 *
 * Strict mode should already guarantee the shape, but a 200 can still arrive
 * from something between here and the model, so every field is checked against
 * its own question rather than trusted. A choice must be an offered key; a score
 * is rounded to a valid level; a noul is clamped to 0–1. Anything missing or of
 * the wrong type throws, because a baseline that silently drops a field would
 * flatter or damn a model by accident.
 */
export function parseBaseline(
  raw: unknown,
  questions: JevQuestionSet,
): Record<string, BaselineAnswer> {
  if (typeof raw !== "object" || raw === null) {
    throw new BaselineParseError("Baseline response was not an object")
  }
  const object = raw as Record<string, unknown>
  const answers: Record<string, BaselineAnswer> = {}

  for (const [name, question] of Object.entries(questions)) {
    const value = object[name]
    if (value === undefined || value === null) {
      throw new BaselineParseError(`Baseline omitted "${name}"`)
    }

    if (question.type === "choice") {
      if (typeof value !== "string" || !(value in question.criteria)) {
        throw new BaselineParseError(
          `Baseline "${name}" was ${JSON.stringify(value)}, not an offered option`,
        )
      }
      answers[name] = { type: "choice", choice: value }
      continue
    }

    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new BaselineParseError(
        `Baseline "${name}" was ${JSON.stringify(value)}, not a number`,
      )
    }

    if (question.type === "score") {
      const top = levelCount(question) - 1
      answers[name] = { type: "score", score: clamp(Math.round(value), 0, top) }
    } else {
      answers[name] = { type: "noul", noul: clamp(value, 0, 1) }
    }
  }

  return answers
}

// ---------------------------------------------------------------------------
// Comparison — as data, never as a score
// ---------------------------------------------------------------------------

/** One question's two answers, side by side, with whether they landed together. */
export interface Comparison {
  name: string
  /** True when the two answers point the same way. Not a correctness claim. */
  agree: boolean
  jev: string
  baseline: string
}

const legendFor = (question: JevQuestion, level: number): string =>
  question.type === "score" ? (question.criteria[level] ?? String(level)) : String(level)

/**
 * Compare one Jev answer with one baseline answer, without judging either.
 *
 * "Agree" is a deliberately loose test — the same choice, the same rounded
 * level, the same side of a coin flip — because the interesting cases are the
 * disagreements, and a stricter test would bury them. There is no third column
 * for "correct": these fixtures have no ground truth, and asserting one would
 * be the exact mistake §7 forbids.
 */
export function compare(
  name: string,
  question: JevQuestion,
  jev: JevAnswer,
  baseline: BaselineAnswer,
): Comparison {
  if (jev.type === "choice" && baseline.type === "choice") {
    return {
      name,
      agree: jev.choice === baseline.choice,
      jev: jev.choice,
      baseline: baseline.choice,
    }
  }
  if (jev.type === "score" && baseline.type === "score") {
    const jevLevel = Math.round(jev.score)
    return {
      name,
      agree: jevLevel === baseline.score,
      jev: `${jev.score.toFixed(2)} (${legendFor(question, jevLevel)})`,
      baseline: `${baseline.score} (${legendFor(question, baseline.score)})`,
    }
  }
  if (jev.type === "noul" && baseline.type === "noul") {
    return {
      name,
      agree: jev.noul >= 0.5 === baseline.noul >= 0.5,
      jev: jev.noul.toFixed(2),
      baseline: baseline.noul.toFixed(2),
    }
  }
  // Types that do not line up cannot be compared; surface it rather than hide it.
  return { name, agree: false, jev: describeAnswer(jev), baseline: describeAnswer(baseline) }
}

function describeAnswer(answer: JevAnswer | BaselineAnswer): string {
  if (answer.type === "choice") return answer.choice
  if (answer.type === "score") return String(answer.score)
  return answer.noul.toFixed(2)
}

/** Compare a whole answer set, in the question set's order. */
export function compareAll(
  questions: JevQuestionSet,
  jev: Record<string, JevAnswer>,
  baseline: Record<string, BaselineAnswer>,
): Comparison[] {
  const out: Comparison[] = []
  for (const [name, question] of Object.entries(questions)) {
    const a = jev[name]
    const b = baseline[name]
    if (!a || !b) continue
    out.push(compare(name, question, a, b))
  }
  return out
}

// A couple of narrowing helpers kept local so tests can lean on the same ones.
export const isChoiceAnswer = (a: JevAnswer): a is ChoiceAnswer => a.type === "choice"
export const isScoreAnswer = (a: JevAnswer): a is ScoreAnswer => a.type === "score"

// ---------------------------------------------------------------------------
// Chat-model prices — dated external data, only ever used to project
// ---------------------------------------------------------------------------

/** A chat model's listed price, per million tokens. Read on a date; it goes stale. */
export interface ChatPrice {
  model: string
  label: string
  inputPerM: number
  outputPerM: number
}

/** The model the baseline actually runs. */
export const BASELINE_MODEL = "anthropic/claude-haiku-4.5"

/**
 * Prices verified on OpenRouter 2026-09-19, in USD per million tokens.
 *
 * Haiku is what the baseline runs; the other two are shown as *projected*
 * alternatives in the same card — plenty of teams do send classification to a
 * frontier model — computed over the measured token count, never measured.
 */
export const CHAT_PRICES: Record<string, ChatPrice> = {
  "anthropic/claude-haiku-4.5": {
    model: "anthropic/claude-haiku-4.5",
    label: "Haiku 4.5",
    inputPerM: 1,
    outputPerM: 5,
  },
  "anthropic/claude-sonnet-5": {
    model: "anthropic/claude-sonnet-5",
    label: "Sonnet 5",
    inputPerM: 2,
    outputPerM: 10,
  },
  "anthropic/claude-opus-5": {
    model: "anthropic/claude-opus-5",
    label: "Opus 5",
    inputPerM: 5,
    outputPerM: 25,
  },
}

/** Project what the same token count would have cost on another chat model. */
export function projectCost(usage: JevUsage, price: ChatPrice): number {
  return (
    (usage.input_tokens * price.inputPerM +
      usage.output_tokens * price.outputPerM) /
    1_000_000
  )
}

// ---------------------------------------------------------------------------
// The /api/chat wire contract
// ---------------------------------------------------------------------------

export interface ChatRequest {
  /** Must be on the sidecar's allowlist; the client cannot pick an arbitrary model. */
  model: string
  system: string
  user: string
  schema: StructuredSchema
}

export interface ChatResponse {
  model: string
  /** The parsed structured object, still to be run through `parseBaseline`. */
  content: Record<string, unknown>
  usage: JevUsage
  /** Measured round trip, including transport. */
  latencyMs: number
}
