import { useCallback, useMemo, useState } from "react"

import { fixtureKey } from "../fixtures"
import type { DemoManifest } from "../types"
import { firstExample } from "./types"

/**
 * Example selection, shared by every runner.
 *
 * Selection and input are one piece of state rather than two, because they can
 * disagree: picking a chip sets both, but typing over the text leaves the
 * input with no example behind it. That case is the reason this exists —
 * a fixture is a recording *of an example*, so text a visitor typed must not
 * replay one. Keeping them in a single `setState` makes it impossible to
 * update the input and forget to drop the example it no longer matches.
 */
export interface Selection<TInput> {
  selected: string | null
  input: TInput
  select: (id: string) => void
  setInput: (input: TInput) => void
  /**
   * The fixture to replay, or undefined when there is nothing legitimate to
   * replay — an edited input, or a demo that was never recorded.
   */
  keyFor: (part?: string) => string | undefined
}

export function useExample<TInput>(
  manifest: DemoManifest<TInput>,
): Selection<TInput> {
  const start =
    manifest.examples.find((example) => example.id === manifest.startAt) ??
    firstExample(manifest.slug, manifest.examples)
  const [state, setState] = useState<{ selected: string | null; input: TInput }>({
    selected: start.id,
    input: start.input,
  })

  const select = useCallback(
    (id: string) => {
      const found = manifest.examples.find((example) => example.id === id)
      if (found) setState({ selected: found.id, input: found.input })
    },
    [manifest],
  )

  const setInput = useCallback(
    (input: TInput) => setState({ selected: null, input }),
    [],
  )

  const keyFor = useCallback(
    (part?: string) =>
      state.selected && manifest.recorded !== false
        ? fixtureKey(manifest.slug, state.selected, part)
        : undefined,
    [manifest, state.selected],
  )

  return useMemo(
    () => ({ ...state, select, setInput, keyFor }),
    [state, select, setInput, keyFor],
  )
}
