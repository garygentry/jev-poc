/**
 * Turn a relevance probability per chunk into a keep-or-drop decision, and
 * account for the tokens that decision saves.
 *
 * The threshold is deliberately *low*, for an asymmetric reason. Dropping a
 * chunk the agent actually needed is a silent failure — the model answers worse
 * and no one sees why. Keeping a chunk that turns out irrelevant costs only its
 * handful of tokens. So the default errs towards keeping: a chunk is dropped
 * only when Jev is clearly against it, not merely unsure. The [[threshold-fitter]]
 * demo will later fit this number against labelled contexts instead of setting
 * it by hand.
 */
export const KEEP_THRESHOLD = 0.5

/** One chunk's size and the relevance the gate gave it (null if it never answered). */
export interface Judged {
  id: string
  tokens: number
  relevance: number | null
}

export interface Pruned {
  kept: Judged[]
  dropped: Judged[]
  keptTokens: number
  droppedTokens: number
  totalTokens: number
  keptCount: number
  droppedCount: number
}

/**
 * Partition the chunks into kept and dropped, and sum the tokens either way.
 *
 * A chunk with no relevance answer is *kept*, not dropped — a missing judgement
 * is not evidence against a chunk, and the safe default when the gate is silent
 * is to leave the context intact rather than quietly shrink it.
 */
export function prune(judged: Judged[], threshold = KEEP_THRESHOLD): Pruned {
  const kept: Judged[] = []
  const dropped: Judged[] = []

  for (const chunk of judged) {
    if (chunk.relevance === null || chunk.relevance >= threshold) kept.push(chunk)
    else dropped.push(chunk)
  }

  const sum = (chunks: Judged[]) => chunks.reduce((total, c) => total + c.tokens, 0)
  const keptTokens = sum(kept)
  const droppedTokens = sum(dropped)

  return {
    kept,
    dropped,
    keptTokens,
    droppedTokens,
    totalTokens: keptTokens + droppedTokens,
    keptCount: kept.length,
    droppedCount: dropped.length,
  }
}
