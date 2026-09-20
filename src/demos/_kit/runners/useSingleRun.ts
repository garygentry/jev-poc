import { useCallback, useEffect, useState } from "react"

import { useJev } from "@/lib/use-jev"

import { fixtureKey } from "../fixtures"
import type { DemoManifest } from "../types"
import type { RunEnvelope, RunnerOptions } from "./types"

/**
 * One state, N questions, one upstream call.
 *
 * The runner owns example selection as well as the request, because the two are
 * the same interaction: picking a different ticket *is* asking again. Keeping
 * them together is what lets a demo's own file hold only its view.
 */
export function useSingleRun<TInput>(
  manifest: DemoManifest<TInput>,
  options: RunnerOptions = {},
): RunEnvelope<TInput> {
  const { auto = true } = options
  const first = manifest.examples[0]
  if (!first) throw new Error(`${manifest.slug}: a demo needs at least one example`)

  const [selected, setSelected] = useState(first.id)
  const { data, error, loading, run: ask } = useJev()

  const example = manifest.examples.find((item) => item.id === selected) ?? first

  const run = useCallback(() => {
    void ask(
      manifest.stateFor(example.input),
      manifest.questions,
      fixtureKey(manifest.slug, example.id),
    )
  }, [ask, manifest, example])

  useEffect(() => {
    if (auto) run()
    // Re-asking on example change is the whole interaction. `run` is rebuilt on
    // every render because `example` is derived, so depending on it here would
    // ask in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, selected])

  return {
    selected,
    select: setSelected,
    example,
    input: example.input,
    answers: data?.answers ?? null,
    error,
    loading,
    latencyMs: data?.latencyMs,
    usage: data?.usage,
    calls: data ? 1 : undefined,
    source: data?.source,
    wire: data?.wire,
    run,
  }
}
