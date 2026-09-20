import { CHAT_PRICES } from "@shared/baseline.ts"
import { isUndecided } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"
import { percent } from "@/lib/format"

/** The two tiers a request can land on. Both are measured; neither is projected. */
export type Tier = "haiku" | "opus"

/** Tier to the chat model that serves it, on the `/api/chat` allowlist. */
export const TIER_MODEL: Record<Tier, string> = {
  haiku: "anthropic/claude-haiku-4.5",
  opus: "anthropic/claude-opus-5",
}

export const tierLabel = (tier: Tier): string =>
  CHAT_PRICES[TIER_MODEL[tier]]?.label ?? tier

/** The cheapest tier each difficulty level is trusted with before promotions. */
export const DIFFICULTY_FLOOR: Record<string, Tier> = {
  routine: "haiku",
  involved: "haiku",
  expert: "opus",
}

/** A noul above this is treated as holding. */
export const LIKELY = 0.6

/**
 * Below this the gate itself is not trusted, and the router promotes rather
 * than guessing.
 *
 * Promoting on doubt is the right default for the asymmetric reason a cascade
 * lives or dies by: over-routing costs a few cents of frontier tokens, while
 * under-routing sends a request the cheap tier will fumble — a wrong refund or
 * a mis-filed ticket that a human then has to catch, apologise for, and redo.
 * The saving is only worth having if it never buys a bad answer on the cases
 * that mattered.
 */
export const TRUSTED_CONFIDENCE = 0.55

const RANK: Record<Tier, number> = { haiku: 0, opus: 1 }
const atLeast = (a: Tier, b: Tier): Tier => (RANK[a] >= RANK[b] ? a : b)

export interface Cascade {
  tier: Tier
  reasons: string[]
  trace: PolicyLine[]
}

/**
 * Choose the cheapest tier that can be trusted with this request.
 *
 * Every rule can only raise the tier, never lower it, so the order the rules
 * run in cannot change the outcome — which is what makes the policy safe to
 * extend. A rule that could demote would make this order-dependent, and is the
 * one thing to avoid when adding to it.
 */
export function chooseTier(answers: Record<string, JevAnswer>): Cascade {
  const difficulty = answers.difficulty
  if (difficulty?.type !== "choice") {
    throw new Error("cascade: `difficulty` must be a choice answer")
  }

  const trace: PolicyLine[] = []
  const line = (code: string, fired?: boolean, note?: string) =>
    trace.push({ code, fired, note })
  const reasons: string[] = []

  line("const DIFFICULTY_FLOOR = {")
  line("  routine: 'haiku', involved: 'haiku', expert: 'opus',")
  line("}")
  line("")

  // Start at the floor the difficulty implies, defaulting up on an unknown
  // value so a new option added to the question cannot route down.
  let tier: Tier = DIFFICULTY_FLOOR[difficulty.choice] ?? "opus"
  line(`let tier = DIFFICULTY_FLOOR['${difficulty.choice}']`, true, tierLabel(tier))
  reasons.push(`${difficulty.choice} → ${tierLabel(tier)}`)

  // An error here is expensive and hard to notice, so pay for the frontier even
  // when the task itself looks routine. This is the rule that keeps the saving
  // honest: the cascade declines to be clever on the cases that can hurt.
  line("")
  const stakes = answers.high_stakes
  const highStakes = stakes?.type === "noul" && stakes.noul > LIKELY
  line(
    "if (high_stakes) tier = atLeast(tier, 'opus')",
    highStakes,
    stakes?.type === "noul" ? stakes.noul.toFixed(2) : undefined,
  )
  if (highStakes) {
    tier = atLeast(tier, "opus")
    reasons.push("irreversible action — worth the frontier's caution")
  }

  // Don't trust a shaky gate. A flat or low-confidence difficulty read is the
  // gate saying it cannot tell, and the safe move is to promote rather than to
  // route down on a coin flip.
  line("")
  const flat = isUndecided(difficulty)
  const untrusted = flat || difficulty.confidence < TRUSTED_CONFIDENCE
  line(
    "if (difficulty.confidence < TRUSTED_CONFIDENCE) tier = 'opus'",
    untrusted,
    untrusted ? percent(difficulty.confidence, 0) : undefined,
  )
  if (untrusted) {
    tier = atLeast(tier, "opus")
    reasons.push(
      flat
        ? "flat difficulty read — promoted rather than guessed"
        : `gate only ${percent(difficulty.confidence, 0)} sure — promoted`,
    )
  }

  line("")
  line(`return '${TIER_MODEL[tier]}'`, true)

  return { tier, reasons, trace }
}
