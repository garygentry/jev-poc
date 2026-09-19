import type { Passage } from "./corpus"

/**
 * Words too common to carry retrieval signal. Deliberately short: a bigger list
 * would tune the baseline, and the baseline is supposed to be crude.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "did", "do", "does",
  "for", "from", "get", "got", "had", "has", "have", "how", "i", "if", "in",
  "is", "it", "its", "me", "my", "no", "not", "now", "of", "on", "or", "our",
  "out", "so", "that", "the", "their", "them", "then", "there", "they", "this",
  "to", "up", "us", "was", "we", "what", "when", "where", "which", "who",
  "will", "with", "you", "your",
])

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))

/**
 * Count how many of the query's content words appear in the passage.
 *
 * This is a weak baseline and biased in its own favour: there is no length
 * normalisation, so longer passages match more words simply by being longer.
 * That makes the comparison conservative rather than rigged — but it is not
 * neutral, and the demo says so.
 */
export function keywordScore(query: string, passage: Passage): number {
  const haystack = new Set(tokenize(`${passage.title} ${passage.body}`))
  const needles = new Set(tokenize(query))
  let hits = 0
  for (const word of needles) if (haystack.has(word)) hits += 1
  return hits
}

export interface Ranked {
  id: string
  score: number
  /** Inclusive 1-based positions this score is consistent with. */
  bounds: [number, number]
}

/**
 * Rank by score, reporting the *range* of positions each score permits.
 *
 * Ties are not rankings. If five passages all score 1, the sort function picks
 * an order among them, but the scorer expressed no opinion — and reporting the
 * position that `sort` happened to produce silently converts "no signal" into
 * "wrong answer", which flatters whatever you are comparing against.
 *
 * Both sides of the comparison go through this function, because correcting
 * only the baseline would flatter the re-ranker by exactly the mechanism being
 * corrected.
 */
export function rankWithBounds(
  scores: Array<{ id: string; score: number }>,
): Ranked[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score)

  // How many strictly beat this score, and how many share it.
  const better = new Map<number, number>()
  const equal = new Map<number, number>()
  for (const { score } of sorted) {
    if (better.has(score)) continue
    better.set(score, sorted.filter((row) => row.score > score).length)
    equal.set(score, sorted.filter((row) => row.score === score).length)
  }

  return sorted.map((row) => {
    const ahead = better.get(row.score) ?? 0
    const shared = equal.get(row.score) ?? 1
    return {
      id: row.id,
      score: row.score,
      bounds: [ahead + 1, ahead + shared],
    }
  })
}

/** Where the gold passage landed, as a range. `null` if it is absent. */
export function boundsOf(ranked: Ranked[], id: string): [number, number] | null {
  return ranked.find((row) => row.id === id)?.bounds ?? null
}

/**
 * Whether a ranking definitely put the gold passage in the top `n`.
 *
 * Requires the *upper* bound to qualify, so a tie that merely could have landed
 * in the top n does not count as a hit. A tie is not a ranking, in this
 * direction too.
 */
export function hitsAt(
  ranked: Ranked[],
  id: string,
  n: number,
): { certain: boolean; possible: boolean } {
  const bounds = boundsOf(ranked, id)
  if (!bounds) return { certain: false, possible: false }
  return { certain: bounds[1] <= n, possible: bounds[0] <= n }
}
