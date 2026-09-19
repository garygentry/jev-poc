/**
 * The models this router chooses between.
 *
 * Prices are USD per million tokens, read from the Claude API reference dated
 * 2026-06-24. Like every price in this app they are **dated external data** and
 * will go stale — they are used only to project hypothetical spend, never to
 * report what a call actually cost.
 */
export interface Model {
  id: string
  name: string
  inputPerMTok: number
  outputPerMTok: number
  /** Context window in tokens. Haiku's is the one that constrains routing. */
  contextTokens: number
  supportsVision: boolean
}

export const MODELS = {
  haiku: {
    id: "claude-haiku-4-5",
    name: "Haiku 4.5",
    inputPerMTok: 1,
    outputPerMTok: 5,
    contextTokens: 200_000,
    supportsVision: true,
  },
  sonnet: {
    id: "claude-sonnet-5",
    name: "Sonnet 5",
    inputPerMTok: 2,
    outputPerMTok: 10,
    contextTokens: 1_000_000,
    supportsVision: true,
  },
  opus: {
    id: "claude-opus-5",
    name: "Opus 5",
    inputPerMTok: 5,
    outputPerMTok: 25,
    contextTokens: 1_000_000,
    supportsVision: true,
  },
} as const satisfies Record<string, Model>

export type ModelKey = keyof typeof MODELS

/** Cheapest first — the order the policy walks when looking for a fit. */
export const LADDER: ModelKey[] = ["haiku", "sonnet", "opus"]

/**
 * A representative request, used only to make the cost comparison concrete.
 *
 * Every projected figure in this demo is this shape multiplied out. It is an
 * assumption, stated here rather than buried in the arithmetic.
 */
export const TYPICAL_REQUEST = { inputTokens: 4_000, outputTokens: 800 }

export function costPerRequest(model: Model): number {
  return (
    (TYPICAL_REQUEST.inputTokens / 1_000_000) * model.inputPerMTok +
    (TYPICAL_REQUEST.outputTokens / 1_000_000) * model.outputPerMTok
  )
}
