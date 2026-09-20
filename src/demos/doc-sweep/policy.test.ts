import { describe, expect, it } from "vitest"

import { DOCUMENTS, chunksOf } from "./document"
import { DISCLOSE_THRESHOLD, sweep } from "./policy"

const doc = DOCUMENTS[0]!
const chunks = chunksOf(doc)

/** Probabilities keyed by chunk id, defaulting to near-zero. */
const probs = (overrides: Record<string, number | null> = {}) => {
  const m = new Map<string, number | null>()
  for (const c of chunks) m.set(c.id, overrides[c.id] ?? 0.03)
  return m
}

describe("chunksOf", () => {
  it("covers every paragraph across the windows", () => {
    const covered = new Set(chunks.flatMap((c) => c.paragraphs.map((p) => p.id)))
    expect(covered.size).toBe(doc.paragraphs.length)
  })

  it("overlaps consecutive windows so no boundary is unshared", () => {
    for (let i = 1; i < chunks.length; i += 1) {
      const prev = new Set(chunks[i - 1]!.paragraphs.map((p) => p.id))
      const shares = chunks[i]!.paragraphs.some((p) => prev.has(p.id))
      expect(shares).toBe(true)
    }
  })
})

describe("sweep", () => {
  it("reports not-found when no chunk clears the threshold", () => {
    const s = sweep(chunks, probs())
    expect(s.found).toBe(false)
    expect(s.matchingParagraphs.size).toBe(0)
  })

  it("finds a disclosure and surfaces the hit chunk's paragraphs", () => {
    const hit = chunks[0]!
    const s = sweep(chunks, probs({ [hit.id]: 0.95 }))
    expect(s.found).toBe(true)
    for (const p of hit.paragraphs) expect(s.matchingParagraphs.has(p.id)).toBe(true)
  })

  it("uses the threshold as the hit boundary", () => {
    expect(sweep(chunks, probs({ [chunks[0]!.id]: DISCLOSE_THRESHOLD })).found).toBe(true)
    expect(sweep(chunks, probs({ [chunks[0]!.id]: DISCLOSE_THRESHOLD - 0.01 })).found).toBe(false)
  })

  it("counts a missing chunk answer as no hit", () => {
    const s = sweep(chunks, probs({ [chunks[0]!.id]: null }))
    expect(s.found).toBe(false)
  })

  it("surfaces an overlapping paragraph once, not twice", () => {
    // Two adjacent windows both hit; their shared paragraph appears a single time.
    const a = chunks[0]!
    const b = chunks[1]!
    const s = sweep(chunks, probs({ [a.id]: 0.9, [b.id]: 0.9 }))
    const ids = [...s.matchingParagraphs]
    expect(new Set(ids).size).toBe(ids.length)
  })
})
