import type { FanOutManifest } from "../types"
import type { RunnerOptions } from "./types"
import { useFanOut, type FanOutEnvelope } from "./useFanOut"

/**
 * A pairwise run is a fan-out whose states are *pairs* of the input's items.
 *
 * Mechanically it is the fan-out — one request per pair, under the server's cap
 * — so this delegates the fetch, the spend guard and the staleness handling to
 * `useFanOut` rather than repeating them. What makes it its own runner is the
 * shape of the rows: each is a comparison of two items, and the demo's job is to
 * turn that set of edges into something whole — clusters, a ranking, a match.
 * The envelope is the same because the results are; the difference is that the
 * caller reads them as a graph, not a list.
 *
 * The pairs live in the manifest's `itemsFor`, not here — N choose 2 is the
 * manifest's to enumerate, and it must be the same enumeration `pnpm capture`
 * records so a replay lines up pair for pair.
 */
export type PairwiseEnvelope<TInput> = FanOutEnvelope<TInput>

interface PairwiseOptions extends RunnerOptions {
  /** Clamped server-side regardless; sending it only makes the intent visible. */
  concurrency?: number
  /** One line in the wire panel saying why this is N requests, one per pair. */
  wireNote?: (pairs: number) => string
}

export function usePairwise<TInput>(
  manifest: FanOutManifest<TInput>,
  options: PairwiseOptions = {},
): PairwiseEnvelope<TInput> {
  const { wireNote, ...rest } = options
  return useFanOut(manifest, {
    ...rest,
    wireNote:
      wireNote ??
      ((pairs) =>
        `${pairs} separate requests — one per pair compared. Shown: the first.`),
  })
}
