import { useCallback, useEffect, useRef, useState } from "react"

import { runBaseline, type BaselineRun } from "@/lib/baseline-client"
import { useSpend } from "@/lib/spend-context"

import type { JevQuestionSet, JevState } from "@shared/jev.ts"

import { TIER_MODEL, type Tier } from "./policy"

/** The measured work: the answer of record on the chosen tier, and on Opus. */
export interface CascadeWork {
  /** What the tier the gate chose actually produced, and what it cost. */
  worker: BaselineRun | null
  /** The "send everything to the frontier" baseline, measured on the same input. */
  opus: BaselineRun | null
  loading: boolean
  error: string | null
  /** Run both. Spends real money on chat models, so it is never automatic. */
  run: () => void
  clear: () => void
}

/**
 * Do the actual work twice: once on the tier the gate chose, once on Opus.
 *
 * This is what makes the cascade's claim measured rather than projected — both
 * halves are real chat completions with real `usage`. When the gate already
 * routed to Opus the two are the same call, so it runs once and shares the
 * result: a hard request honestly shows the cascade saving nothing, because the
 * saving only ever comes from the routine ones.
 *
 * Like the measured baseline, it guards on spend and on staleness: nothing runs
 * until asked, and a result for a request the visitor has moved off is dropped
 * rather than shown beside another request's gate.
 */
export function useCascadeWork(
  tier: Tier | null,
  questions: JevQuestionSet,
  state: JevState,
): CascadeWork {
  const [worker, setWorker] = useState<BaselineRun | null>(null)
  const [opus, setOpus] = useState<BaselineRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refresh } = useSpend()

  // The tier is part of the identity: a worker result recorded for Haiku must
  // not linger if the gate has since re-decided on Opus for a new request.
  const key = `${tier}:${JSON.stringify(state)}`
  const activeKey = useRef(key)

  useEffect(() => {
    activeKey.current = key
    setWorker(null)
    setOpus(null)
    setError(null)
    setLoading(false)
  }, [key])

  const run = useCallback(() => {
    if (!tier) return
    const startedFor = key
    setLoading(true)
    setError(null)

    const opusModel = TIER_MODEL.opus
    const workerModel = TIER_MODEL[tier]
    const opusCall = runBaseline(questions, state, opusModel)
    // A hard request is already going to Opus; running it a second time as the
    // baseline would double the bill for an identical answer.
    const workerCall =
      workerModel === opusModel ? opusCall : runBaseline(questions, state, workerModel)

    Promise.all([workerCall, opusCall])
      .then(([workerRun, opusRun]) => {
        // Billed whether or not the input is still on screen, so the meter is
        // refreshed either way; only the panel is guarded against staleness.
        void refresh()
        if (activeKey.current !== startedFor) return
        setWorker(workerRun)
        setOpus(opusRun)
      })
      .catch((caught: unknown) => {
        if (activeKey.current !== startedFor) return
        setError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => {
        if (activeKey.current === startedFor) setLoading(false)
      })
  }, [tier, questions, state, key, refresh])

  const clear = useCallback(() => {
    setWorker(null)
    setOpus(null)
    setError(null)
  }, [])

  return { worker, opus, loading, error, run, clear }
}
