import { isUndecided } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"
import { percent } from "@/lib/format"

/** Run it, prompt the user, or refuse and make them run it themselves. */
export type Verdict = "allow" | "ask" | "deny"

export type RadiusRule =
  /** Auto-allowed once Jev is at least this sure of the classification. */
  | { allowAt: number }
  /** No confidence suffices; the only question is how hard the stop is. */
  | { never: Extract<Verdict, "ask" | "deny"> }

/**
 * What each blast radius earns.
 *
 * This table is the whole demo. A single global cutoff is the mistake almost
 * everyone makes first: it treats being wrong about `ls` and being wrong about
 * `aws s3 rm --recursive` as the same error, when one costs a redundant prompt
 * and the other costs a production bucket.
 *
 * Past `reversible` the gate stops being a number, because the question is no
 * longer how certain the model is — it is who gets to decide.
 */
export const RADIUS_POLICY: Record<string, RadiusRule> = {
  read_only: { allowAt: 0.7 },
  reversible: { allowAt: 0.9 },
  destructive: { never: "ask" },
  catastrophic: { never: "deny" },
}

/** A noul above this is treated as holding. */
export const LIKELY = 0.6

/** Conditions that force a prompt however benign the radius looks. */
export const HARD_STOPS = [
  "touches_secrets",
  "network_egress",
  "affects_production",
] as const

export interface Ruling {
  verdict: Verdict
  reason: string
  /** Every condition that contributed, for the audit line. */
  flags: string[]
  trace: PolicyLine[]
}

/**
 * Decide whether to run, prompt, or refuse.
 *
 * The checks run in order of severity — refuse, then prompt, then allow — so a
 * later, milder rule can never soften an earlier one. Ordering them the other
 * way round is a subtle and expensive bug: put the hard stops first and
 * `curl … | sh` downgrades from "refuse" to "prompt" purely because it also
 * touches the network.
 *
 * The default throughout is to ask. An agent that asks too often is annoying;
 * one that allows too often is dangerous, and only the first is recoverable by
 * the user noticing.
 */
export function rule(answers: Record<string, JevAnswer>): Ruling {
  const radius = answers.blast_radius
  if (radius?.type !== "choice") {
    throw new Error("guardrail: `blast_radius` must be a choice answer")
  }

  const trace: PolicyLine[] = []
  const line = (code: string, fired?: boolean, note?: string) =>
    trace.push({ code, fired, note })
  const flags: string[] = []

  line("const RADIUS_POLICY = {")
  line("  read_only:   { allowAt: 0.70 },")
  line("  reversible:  { allowAt: 0.90 },")
  line("  destructive: { never: 'ask'  },")
  line("  catastrophic:{ never: 'deny' },")
  line("}")
  line("")

  // 1. The model declining to answer is itself a signal.
  const flat = isUndecided(radius)
  line("if (isUndecided(blast_radius)) return 'ask'", flat, flat ? "flat" : undefined)
  if (flat) {
    return {
      verdict: "ask",
      reason: "Jev could not classify this command — the distribution is flat.",
      flags: ["undecided"],
      trace,
    }
  }

  // 2. An unknown radius fails closed. A new option added to the question but
  //    not to this table must never fall through to `allow`.
  const policy = RADIUS_POLICY[radius.choice]
  line("")
  line(
    `const policy = RADIUS_POLICY['${radius.choice}'] ?? { never: 'deny' }`,
    true,
    policy ? undefined : "unknown radius",
  )

  // 3. Refusals, before anything that could soften them.
  const refuses = !policy || (("never" in policy) && policy.never === "deny")
  line("if (policy.never === 'deny') return 'deny'", refuses)
  if (refuses) {
    return {
      verdict: "deny",
      reason: policy
        ? `A ${humanRadius(radius.choice)} command is never run by the agent. Run it yourself if you mean it.`
        : `Unrecognised blast radius "${radius.choice}" — failing closed.`,
      flags: [radius.choice],
      trace,
    }
  }

  // 4. Prompts forced by a property of the command rather than its radius.
  line("")
  for (const name of HARD_STOPS) {
    const answer = answers[name]
    const holds = answer?.type === "noul" && answer.noul > LIKELY
    if (holds) flags.push(name)
    line(
      `if (${name} > LIKELY) return 'ask'`,
      holds,
      answer?.type === "noul" ? answer.noul.toFixed(2) : undefined,
    )
  }
  if (flags.length > 0) {
    return {
      verdict: "ask",
      reason: `Needs confirmation: ${flags.map((flag) => flag.replace(/_/g, " ")).join(", ")}.`,
      flags,
      trace,
    }
  }

  // 5. Radii that are never automatic, but are not refusals either.
  const alwaysAsks = "never" in policy
  line("")
  line("if (policy.never === 'ask') return 'ask'", alwaysAsks)
  if (alwaysAsks) {
    return {
      verdict: "ask",
      reason: `A ${humanRadius(radius.choice)} command is never run without asking, at any confidence.`,
      flags: [radius.choice],
      trace,
    }
  }

  // 6. The confidence gate for this radius.
  const gate = policy.allowAt
  const cleared = radius.confidence >= gate
  line("")
  line(
    `if (blast_radius.confidence < ${gate}) return 'ask'`,
    !cleared,
    percent(radius.confidence, 0),
  )
  if (!cleared) {
    return {
      verdict: "ask",
      reason: `Reads as ${humanRadius(radius.choice)}, but at ${percent(radius.confidence, 0)} against a ${percent(gate, 0)} gate.`,
      flags: ["below gate"],
      trace,
    }
  }

  line("return 'allow'", true)
  return {
    verdict: "allow",
    reason: `${humanRadius(radius.choice)} at ${percent(radius.confidence, 0)}, clear of the ${percent(gate, 0)} gate.`,
    flags: [],
    trace,
  }
}

const humanRadius = (choice: string) => choice.replace(/_/g, " ")
