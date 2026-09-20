import type { Chunk } from "./document"

/**
 * The probability at which a chunk counts as a hit.
 *
 * Above a coin flip: a sweep that surfaced every faint maybe would be as useless
 * as reading the whole document, which is what it replaces. A real disclosure
 * reads high; the boilerplate around it reads near zero.
 */
export const DISCLOSE_THRESHOLD = 0.6

/** One chunk's verdict. */
export interface ChunkHit {
  chunk: Chunk
  probability: number | null
  hit: boolean
}

export interface Sweep {
  chunks: ChunkHit[]
  /** True when any chunk clears the threshold. */
  found: boolean
  /** Paragraph ids that fall in at least one hit chunk — what a reader should read. */
  matchingParagraphs: Set<string>
}

/**
 * Aggregate the per-chunk answers into a document-level verdict.
 *
 * A missing chunk answer never counts as a hit — silence is not a disclosure —
 * and the matching paragraphs are the union of every hit chunk's paragraphs, so
 * a paragraph caught by either of two overlapping windows is surfaced once.
 */
export function sweep(
  chunks: Chunk[],
  probabilityByChunk: Map<string, number | null>,
): Sweep {
  const results: ChunkHit[] = chunks.map((chunk) => {
    const probability = probabilityByChunk.get(chunk.id) ?? null
    return { chunk, probability, hit: probability !== null && probability >= DISCLOSE_THRESHOLD }
  })

  const matchingParagraphs = new Set<string>()
  for (const r of results) {
    if (r.hit) for (const p of r.chunk.paragraphs) matchingParagraphs.add(p.id)
  }

  return {
    chunks: results,
    found: results.some((r) => r.hit),
    matchingParagraphs,
  }
}
