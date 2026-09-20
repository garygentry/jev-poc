import { useCallback, useState } from "react"

import { batch } from "@/lib/jev-client"
import { useSpend } from "@/lib/spend-context"

import type { FanOutManifest } from "../types"
import type { RunEnvelope, RunnerOptions } from "./types"
import { useExample } from "./useExample"

import type {
  AnswerSource,
  BatchItemResult,
  JevUsage,
  JevWire,
} from "@shared/jev.ts"

export interface FanOutEnvelope<TInput> extends RunEnvelope<TInput> {
  /** One entry per state, in the order the manifest produced them. */
  results: BatchItemResult[] | null
}

interface FanOutOptions extends RunnerOptions {
  /** Clamped server-side regardless; sending it only makes the intent visible. */
  concurrency?: number
  /** One line in the wire panel saying why this is N requests and not one. */
  wireNote?: (items: number) => string
}

/**
 * N states, one shared question set, fanned out under the server's cap.
 *
 * `auto` defaults to **false** here, unlike the single runner. A fan-out is the
 * one shape in this repo that can spend real money in proportion to its input,
 * and nothing should spend money because a page was opened. Every fan-out demo
 * waits to be asked.
 */
export function useFanOut<TInput>(
  manifest: FanOutManifest<TInput>,
  options: FanOutOptions = {},
): FanOutEnvelope<TInput> {
  const { concurrency, wireNote } = options
  const selection = useExample(manifest)
  const { refresh } = useSpend()

  const [run, setRun] = useState<{
    results: BatchItemResult[]
    usage: JevUsage
    wallClockMs: number
    source: AnswerSource
    wire: JevWire
    calls: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { input, keyFor } = selection
  const clear = useCallback(() => {
    setRun(null)
    setError(null)
  }, [])

  const start = useCallback(() => {
    const items = manifest.itemsFor(input)
    const first = items[0]

    setLoading(true)
    setError(null)
    setRun(null)

    void batch({ items, questions: manifest.questions, fixtureKey: keyFor(), concurrency })
      .then((response) => {
        setRun({
          results: response.results,
          usage: response.usage,
          wallClockMs: response.wallClockMs,
          source: response.source,
          calls: items.length,
          wire: {
            // The panel can only show one request, so it says so. A fan-out's
            // honest wire is "this, N times", not a reconstruction of a batch
            // that never existed as a single call.
            request: {
              note:
                wireNote?.(items.length) ??
                `${items.length} separate requests — one per state. Shown: the first.`,
              model: "typesafe/jev-1.13",
              state: first?.state,
              questions: manifest.questions,
            },
            response: response.results.slice(0, 3),
          },
        })
        void refresh()
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => setLoading(false))
  }, [manifest, input, keyFor, concurrency, wireNote, refresh])

  return {
    ...selection,
    // Changing the input invalidates the last fan-out. Dropping it is not a
    // nicety: leaving twenty-four ranked rows on screen under a different
    // query reads as a result for that query.
    select: (id: string) => {
      selection.select(id)
      clear()
    },
    setInput: (next: TInput) => {
      selection.setInput(next)
      clear()
    },
    // A fan-out's answers are per row, not one set over one state.
    answers: null,
    results: run?.results ?? null,
    error,
    loading,
    latencyMs: run?.wallClockMs,
    usage: run?.usage,
    calls: run?.calls,
    source: run?.source,
    wire: run?.wire,
    run: start,
    clear,
  }
}
