import { useEffect, useRef } from "react"

import { useJev } from "@/lib/use-jev"

import type { SingleManifest } from "../types"
import type { RunEnvelope } from "./types"
import { useExample } from "./useExample"

export interface LiveEnvelope<TInput> extends RunEnvelope<TInput> {
  /** Measured round trips, most recent last, for the sparkline. */
  history: number[]
}

interface LiveRunOptions<TInput> {
  /**
   * How long a pause counts as "stopped".
   *
   * Long enough not to fire a request per keystroke, short enough that the
   * answers feel attached to the input. The in-flight request is dropped on
   * every new one, so an over-eager debounce costs latency rather than money.
   */
  debounceMs?: number
  /**
   * Whether this input is worth asking about at all.
   *
   * Returning false clears the last answers rather than leaving them on screen:
   * a judgement of text that has since been deleted is worse than no judgement.
   */
  shouldAsk?: (input: TInput) => boolean
}

/**
 * Re-ask on every pause in editing.
 *
 * The same single request as `useSingleRun`, driven by a debounce rather than a
 * button — which is a thing you can only build against a model that answers in
 * about a tenth of a second and returns something typed. Stale answers are
 * dropped rather than merged: `useJev`'s `cancelPrevious` means a slow response
 * can never land on top of a newer one and describe text that is already gone.
 */
export function useLiveRun<TInput>(
  manifest: SingleManifest<TInput>,
  options: LiveRunOptions<TInput> = {},
): LiveEnvelope<TInput> {
  const { debounceMs = 260, shouldAsk } = options
  const selection = useExample(manifest)
  const { data, error, loading, history, run: ask, reset } = useJev({
    cancelPrevious: true,
  })

  const { input, keyFor } = selection
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)

    if (shouldAsk && !shouldAsk(input)) {
      reset()
      return
    }

    timer.current = setTimeout(() => {
      void ask(manifest.stateFor(input), manifest.questions, keyFor())
    }, debounceMs)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // Editing is the whole interaction, and `keyFor` is derived from the same
    // state as `input`, so depending on it as well would only re-run this in a
    // loop on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, debounceMs])

  return {
    ...selection,
    answers: data?.answers ?? null,
    error,
    loading,
    history,
    latencyMs: data?.latencyMs,
    usage: data?.usage,
    calls: data ? 1 : undefined,
    source: data?.source,
    wire: data?.wire,
    run: () => void ask(manifest.stateFor(input), manifest.questions, keyFor()),
    clear: reset,
  }
}
