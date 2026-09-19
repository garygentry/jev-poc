import { useCallback, useRef, useState } from "react"

import { decide } from "./jev-client"
import { useSpend } from "./spend-context"

import type {
  DecideResponse,
  JevQuestionSet,
  JevState,
} from "@shared/jev.ts"

interface UseJevOptions {
  /**
   * Drop the in-flight request when a new one starts.
   *
   * On for the live demo, where a newer keystroke makes the previous answer
   * irrelevant before it arrives; off where every answer matters.
   */
  cancelPrevious?: boolean
}

export interface UseJevResult {
  data: DecideResponse | null
  error: string | null
  loading: boolean
  /** Measured latencies, most recent last, for the sparkline. */
  history: number[]
  run: (
    state: JevState,
    questions: JevQuestionSet,
    fixtureKey?: string,
  ) => Promise<DecideResponse | null>
  reset: () => void
}

/**
 * Ask Jev one question set against one state.
 *
 * Only the latest call is allowed to write state. Without that guard a slow
 * response can land after a faster newer one and overwrite it, which in the
 * live demo means the panel showing a judgement of text you have already
 * replaced.
 */
export function useJev(options: UseJevOptions = {}): UseJevResult {
  const { cancelPrevious = false } = options
  const [data, setData] = useState<DecideResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<number[]>([])

  const { refresh } = useSpend()
  const controller = useRef<AbortController | null>(null)
  const generation = useRef(0)

  const run = useCallback(
    async (
      state: JevState,
      questions: JevQuestionSet,
      fixtureKey?: string,
    ): Promise<DecideResponse | null> => {
      if (cancelPrevious) controller.current?.abort()
      const local = new AbortController()
      controller.current = local

      generation.current += 1
      const mine = generation.current

      setLoading(true)
      setError(null)

      try {
        const response = await decide({ state, questions, fixtureKey }, local.signal)
        if (mine !== generation.current) return null

        setData(response)
        if (!response.replayed) {
          setHistory((previous) => [...previous, response.latencyMs].slice(-40))
          void refresh()
        }
        return response
      } catch (caught) {
        if (local.signal.aborted || mine !== generation.current) return null
        setError(caught instanceof Error ? caught.message : String(caught))
        return null
      } finally {
        if (mine === generation.current) setLoading(false)
      }
    },
    [cancelPrevious, refresh],
  )

  const reset = useCallback(() => {
    controller.current?.abort()
    generation.current += 1
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { data, error, loading, history, run, reset }
}
