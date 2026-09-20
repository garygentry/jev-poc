import type { FanOutManifest } from "../types"
import type { RunnerOptions } from "./types"
import { useFanOut, type FanOutEnvelope } from "./useFanOut"

/**
 * A windowed run is a fan-out whose states are *ordered slices of one input*.
 *
 * Mechanically it is the fan-out exactly: N states, one shared question set, one
 * request each under the server's cap — so this delegates rather than
 * re-implementing the fetch, the spend guard and the staleness handling that
 * `useFanOut` already owns. What makes it its own runner is what the rows
 * *mean*. A fan-out's rows are independent (passages to rank, chunks to keep);
 * a windowed run's rows are a sequence, and their **position is the axis** the
 * demo reads along — "where does progress stop", not "which ones matter". The
 * envelope is the same shape because the results are; the difference is that the
 * caller is entitled to treat their order as time.
 *
 * The window geometry — size and stride — lives in the manifest's `itemsFor`,
 * not here, because `pnpm capture` records each window by its id and has to
 * replay the same slices the UI asks. A runner that sliced the input itself
 * could not be captured.
 */
export type WindowedEnvelope<TInput> = FanOutEnvelope<TInput>

interface WindowedOptions extends RunnerOptions {
  /** Clamped server-side regardless; sending it only makes the intent visible. */
  concurrency?: number
  /** One line in the wire panel saying why this is N requests over one trace. */
  wireNote?: (windows: number) => string
}

export function useWindowed<TInput>(
  manifest: FanOutManifest<TInput>,
  options: WindowedOptions = {},
): WindowedEnvelope<TInput> {
  const { wireNote, ...rest } = options
  return useFanOut(manifest, {
    ...rest,
    wireNote:
      wireNote ??
      ((windows) =>
        `${windows} separate requests — one per window sliding over a single ` +
        `trace. Shown: the first.`),
  })
}
