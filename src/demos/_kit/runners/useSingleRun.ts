import { useCallback, useEffect } from "react"

import { useJev } from "@/lib/use-jev"

import type { SingleManifest } from "../types"
import type { RunEnvelope, RunnerOptions } from "./types"
import { useExample } from "./useExample"

interface SingleRunOptions extends RunnerOptions {
  /** Drop an in-flight request when a newer one starts. See `useJev`. */
  cancelPrevious?: boolean
}

/**
 * One state, N questions, one upstream call.
 *
 * The runner owns example selection as well as the request, because the two are
 * the same interaction: picking a different ticket *is* asking again. Keeping
 * them together is what lets a demo's own file hold only its view.
 */
export function useSingleRun<TInput>(
  manifest: SingleManifest<TInput>,
  options: SingleRunOptions = {},
): RunEnvelope<TInput> {
  const { auto = true, cancelPrevious = false } = options
  const selection = useExample(manifest)
  const { data, error, loading, run: ask, reset } = useJev({ cancelPrevious })

  const { input, keyFor } = selection

  const run = useCallback(() => {
    void ask(manifest.stateFor(input), manifest.questions, keyFor())
  }, [ask, manifest, input, keyFor])

  useEffect(() => {
    if (auto) run()
    // Re-asking on a change of input is the whole interaction. `run` is rebuilt
    // whenever the input object identity changes, so depending on it directly
    // would ask in a loop on any demo whose input is edited in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, input])

  return {
    ...selection,
    answers: data?.answers ?? null,
    error,
    loading,
    latencyMs: data?.latencyMs,
    usage: data?.usage,
    calls: data ? 1 : undefined,
    source: data?.source,
    wire: data?.wire,
    run,
    clear: reset,
  }
}
