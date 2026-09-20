import { useCallback, useEffect, useRef, useState } from "react"

import { runBaseline, type BaselineRun } from "@/lib/baseline-client"
import { useSpend } from "@/lib/spend-context"

import type { JevQuestionSet, JevState } from "@shared/jev.ts"

/** An on-demand measured baseline: nothing runs until `run` is called. */
export interface BaselineController {
  result: BaselineRun | null
  loading: boolean
  error: string | null
  /** Ask the chat model. This spends real money, so it is never automatic. */
  run: () => void
  clear: () => void
}

/**
 * Fetch a measured baseline for one state, but only when asked.
 *
 * The whole point of the guard is spend: a fan-out never fires on render, and a
 * baseline is stricter still — it calls a *second*, dearer model, so it runs
 * only on an explicit click behind a badge. The result is dropped the moment
 * the input changes, because a baseline for the previous ticket shown beside
 * this ticket's Jev answers would be a quiet lie.
 */
export function useBaseline(
  questions: JevQuestionSet,
  state: JevState,
): BaselineController {
  const [result, setResult] = useState<BaselineRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refresh } = useSpend()

  // An in-flight request for an input the visitor has since moved off must not
  // land in the panel; the key it was started against is checked on arrival.
  const key = JSON.stringify(state)
  const activeKey = useRef(key)

  useEffect(() => {
    activeKey.current = key
    setResult(null)
    setError(null)
    setLoading(false)
  }, [key])

  const run = useCallback(() => {
    const startedFor = key
    setLoading(true)
    setError(null)
    runBaseline(questions, state)
      .then((run) => {
        // The call is billed whether or not its input is still on screen, so
        // the meter is refreshed either way — only the panel is guarded.
        void refresh()
        if (activeKey.current !== startedFor) return
        setResult(run)
      })
      .catch((error: unknown) => {
        if (activeKey.current !== startedFor) return
        setError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (activeKey.current === startedFor) setLoading(false)
      })
  }, [questions, state, key, refresh])

  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, loading, error, run, clear }
}
