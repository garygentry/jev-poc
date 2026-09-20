import type { AnswerSource, JevAnswer, JevUsage, JevWire } from "@shared/jev.ts"

import type { DemoExample } from "../types"

/**
 * The one envelope every runner returns, whatever shape of work it does.
 *
 * `DemoScaffold` renders against this and nothing else, so a demo can change
 * from one request to a fan-out without the frame around it knowing. The cost
 * of that is that a few fields are optional in ways a given runner will never
 * exercise — `latencyMs` is a round trip for a single call and wall-clock for a
 * fan-out, and both are absent until something has actually run.
 */
export interface RunEnvelope<TInput> {
  /** The example currently selected, and the control to change it. */
  selected: string
  select: (id: string) => void
  example: DemoExample<TInput>
  input: TInput

  /** Named answers from the last completed run, or null before one lands. */
  answers: Record<string, JevAnswer> | null
  error: string | null
  loading: boolean

  /**
   * Measured figures, and where the answers came from.
   *
   * These are reported only when `source === "live"`. A replayed fixture
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

  /** Ask again for the current example. */
  run: () => void
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
