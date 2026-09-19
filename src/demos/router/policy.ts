import { isUndecided } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"
import { percent } from "@/lib/format"

import { MODELS, type ModelKey } from "./models"

/** The cheapest model that each capability level is trusted with. */
export const CAPABILITY_FLOOR: Record<string, ModelKey> = {
  trivial: "haiku",
  simple: "haiku",
  reasoning: "sonnet",
  expert: "opus",
}

/** A noul above this is treated as holding. */
export const LIKELY = 0.6

/**
 * Below this the classification is not trusted, and the router promotes rather
 * than guessing.
 *
 * Promoting on doubt is the right default here for an asymmetric reason:
 * over-routing costs a few cents, under-routing costs a bad answer the user has
 * to notice, complain about, and wait through a retry for.
 */
export const TRUSTED_CONFIDENCE = 0.55

const RANK: Record<ModelKey, number> = { haiku: 0, sonnet: 1, opus: 2 }
const atLeast = (a: ModelKey, b: ModelKey): ModelKey => (RANK[a] >= RANK[b] ? a : b)

export interface Route {
  model: ModelKey
  reasons: string[]
  /** True when the request should be clarified before being sent anywhere. */
  clarifyFirst: boolean
  trace: PolicyLine[]
}

/**
 * Choose the cheapest model that can do the job.
 *
 * Each rule can only ever raise the floor, never lower it, so the order the
 * rules run in does not change the outcome — which makes the policy safe to
 * extend. A rule that could demote would make this order-dependent and is the
 * thing to avoid when adding to it.
 */
export function chooseModel(answers: Record<string, JevAnswer>): Route {
  const capability = answers.required_capability
  if (capability?.type !== "choice") {
    throw new Error("router: `required_capability` must be a choice answer")
  }

  const trace: PolicyLine[] = []
  const line = (code: string, fired?: boolean, note?: string) =>
    trace.push({ code, fired, note })
  const reasons: string[] = []

  line("const CAPABILITY_FLOOR = {")
  line("  trivial: 'haiku',   simple: 'haiku',")
  line("  reasoning: 'sonnet', expert: 'opus',")
  line("}")
  line("")

  // Start at the floor the capability implies, defaulting up on an unknown
  // value so a new option added to the question cannot route down.
  let model: ModelKey = CAPABILITY_FLOOR[capability.choice] ?? "opus"
  line(
    `let model = CAPABILITY_FLOOR['${capability.choice}']`,
    true,
    MODELS[model].name,
  )
  reasons.push(`${capability.choice} capability → ${MODELS[model].name}`)

  // An untrusted classification is promoted one step rather than acted on.
  const flat = isUndecided(capability)
  const untrusted = flat || capability.confidence < TRUSTED_CONFIDENCE
  line("")
  line(
    "if (capability.confidence < TRUSTED_CONFIDENCE) model = promote(model)",
    untrusted,
    untrusted ? percent(capability.confidence, 0) : undefined,
  )
  if (untrusted) {
    model = atLeast(model, model === "haiku" ? "sonnet" : "opus")
    reasons.push(
      flat
        ? "flat distribution — promoted rather than guessed"
        : `classification only ${percent(capability.confidence, 0)} confident — promoted`,
    )
  }

  // Hard capability requirements. Each can only raise the floor.
  line("")
  const long = answers.needs_long_context
  const needsLong = long?.type === "noul" && long.noul > LIKELY
  line(
    "if (needs_long_context) model = atLeast(model, 'sonnet')  // Haiku is 200k",
    needsLong,
    long?.type === "noul" ? long.noul.toFixed(2) : undefined,
  )
  if (needsLong) {
    model = atLeast(model, "sonnet")
    reasons.push(
      `needs more than ${(MODELS.haiku.contextTokens / 1000).toFixed(0)}k context`,
    )
  }

  const tools = answers.needs_tools
  const needsTools = tools?.type === "noul" && tools.noul > LIKELY
  line(
    "if (needs_tools) model = atLeast(model, 'sonnet')",
    needsTools,
    tools?.type === "noul" ? tools.noul.toFixed(2) : undefined,
  )
  if (needsTools) {
    model = atLeast(model, "sonnet")
    reasons.push("multi-step tool use")
  }

  const code = answers.task_type
  const hardCode =
    code?.type === "choice" &&
    code.choice === "code" &&
    capability.choice === "expert"
  line(
    "if (task_type === 'code' && capability === 'expert') model = 'opus'",
    hardCode,
  )
  if (hardCode) {
    model = atLeast(model, "opus")
    reasons.push("expert-level code")
  }

  // Ambiguity is not a model problem — no model can answer a question that has
  // not been asked yet. Routing an underspecified request anywhere just buys a
  // confident wrong answer.
  line("")
  const ambiguous = answers.is_ambiguous
  const unclear = ambiguous?.type === "noul" && ambiguous.noul > LIKELY
  line(
    "if (is_ambiguous) return { clarifyFirst: true }",
    unclear,
    ambiguous?.type === "noul" ? ambiguous.noul.toFixed(2) : undefined,
  )
  if (unclear) {
    reasons.push("underspecified — ask before sending")
  }

  line("")
  line(`return '${MODELS[model].id}'`, true)

  return { model, reasons, clarifyFirst: unclear, trace }
}
