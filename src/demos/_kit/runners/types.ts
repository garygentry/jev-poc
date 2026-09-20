import type { AnswerSource, JevAnswer, JevUsage, JevWire } from "@shared/jev.ts"

import type { DemoExample } from "../types"

/**
 * The one envelope every runner returns, whatever shape of work it does.
 *
 * A demo renders against this and nothing else, so changing from one request to
 * a fan-out does not change the frame around it. The cost is that a few fields
 * mean slightly different things per runner — `latencyMs` is a round trip for a
 * single call and wall-clock for a fan-out — and all of them are absent until
 * something has actually run.
 */
export interface RunEnvelope<TInput> {
  /**
   * The example currently selected, or null once the input has been edited
   * away from all of them.
   *
   * That distinction is not cosmetic: a recorded fixture belongs to an example,
   * so text the visitor typed has no fixture and must not replay one.
   */
  selected: string | null
  select: (id: string) => void
  /** Replace the input directly, for the demos whose input is editable. */
  setInput: (input: TInput) => void
  input: TInput

  /**
   * Named answers from the last completed run.
   *
   * Only the runners that ask one question set of one state fill this. A
   * fan-out's answers are per-row and live in its own result type.
   */
  answers: Record<string, JevAnswer> | null
  error: string | null
  loading: boolean

  /**
   * Measured figures, and where the answers came from.
   *
   * Reported by the UI only when `source === "live"`. A replayed fixture
   * carries a token count and a cost, but no call was made and no money was
   * spent, so presenting them would invite reading a recording as this run.
   */
  latencyMs?: number
  usage?: JevUsage
  /** Upstream calls this run actually made. */
  calls?: number
  source?: AnswerSource
  /** The literal bytes each way, so the UI shows the request rather than a retelling. */
  wire?: JevWire

  /** Ask again for the current input. */
  run: () => void
  /** Drop the last result, for demos that must not show a verdict for stale input. */
  clear: () => void
}

export interface RunnerOptions {
  /**
   * Ask on mount and whenever the example changes.
   *
   * On for the demos where re-asking *is* the interaction. Off for the ones
   * that fan out, which must never spend money because someone opened a page.
   */
  auto?: boolean
}

/** The example a runner starts on, and the guard every runner needs. */
export function firstExample<TInput>(
  slug: string,
  examples: Array<DemoExample<TInput>>,
): DemoExample<TInput> {
  const first = examples[0]
  if (!first) throw new Error(`${slug}: a demo needs at least one example`)
  return first
}
