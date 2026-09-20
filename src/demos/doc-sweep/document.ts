import type { JevState } from "@shared/jev.ts"

/** One paragraph of the document. */
export interface Paragraph {
  id: string
  heading: string
  text: string
}

export interface Document {
  id: string
  label: string
  paragraphs: Paragraph[]
}

/**
 * What the sweep looks for — one topic, stated once and shown in the UI.
 *
 * It lives here rather than being asked per-run because the question is fixed:
 * the demo is reading a long policy for a single thing, the way a person opens a
 * forty-page document to answer exactly one question.
 */
export const TOPIC =
  "the company shares users' personal data with third parties for advertising or marketing"

/**
 * The chunk geometry — a window of paragraphs, overlapping by one.
 *
 * Overlap is the cheap insurance against the cost this demo is honest about: a
 * disclosure that straddles a chunk boundary would be read in half by two
 * windows and missed by both, so consecutive windows share a paragraph. It does
 * not fix everything — a clause that depends on a definition pages away is still
 * judged without it — which is exactly what "state what chunking costs" means.
 */
export const WINDOW = 3
export const STRIDE = 2

export interface Chunk {
  id: string
  startIndex: number
  paragraphs: Paragraph[]
}

/** Slide the window over the document. The last window is anchored to the end. */
export const chunksOf = (doc: Document): Chunk[] => {
  const chunks: Chunk[] = []
  const n = doc.paragraphs.length
  for (let i = 0; i + WINDOW <= n; i += STRIDE) {
    chunks.push({
      id: `c${i}`,
      startIndex: i,
      paragraphs: doc.paragraphs.slice(i, i + WINDOW),
    })
  }
  // If the stride left a tail uncovered, add a final window flush with the end.
  const last = chunks[chunks.length - 1]
  if (!last || last.startIndex + WINDOW < n) {
    const start = Math.max(0, n - WINDOW)
    chunks.push({ id: `c${start}`, startIndex: start, paragraphs: doc.paragraphs.slice(start) })
  }
  return chunks
}

/** What the gate judges: one chunk of the document, against the topic. */
export const stateFor = (paragraphs: Paragraph[]): JevState => ({
  passage: paragraphs.map((p) => `${p.heading}: ${p.text}`).join("\n\n"),
})

/**
 * A privacy policy, most of it the usual reassurances, with the disclosures that
 * actually matter buried two-thirds of the way down.
 *
 * The point is the burial: the sharing-for-advertising language sits between a
 * cookie paragraph and a data-retention paragraph, phrased as blandly as the
 * boilerplate around it — the needle a sweep has to find in a document too long
 * to read closely end to end.
 */
export const DOCUMENTS: Document[] = [
  {
    id: "privacy-policy",
    label: "A privacy policy",
    paragraphs: [
      { id: "intro", heading: "Introduction", text: "This policy explains how we collect, use, and protect your information. Your privacy matters to us and we are committed to handling your data responsibly." },
      { id: "collect", heading: "Information We Collect", text: "We collect the information you provide when you create an account, such as your name and email, and information generated as you use the service, such as your settings and activity." },
      { id: "use", heading: "How We Use Information", text: "We use your information to operate the service, personalise your experience, respond to support requests, and keep the service secure and reliable." },
      { id: "security", heading: "Security", text: "We encrypt data in transit and at rest, restrict internal access on a need-to-know basis, and undergo regular independent security assessments." },
      { id: "cookies", heading: "Cookies", text: "We use essential cookies to keep you signed in and remember your preferences. You can control non-essential cookies through your browser or our consent banner." },
      { id: "ads", heading: "Advertising and Analytics", text: "To support the free tier, we share certain usage data and device identifiers with advertising and analytics partners, who may use it to build profiles and serve targeted ads across other sites." },
      { id: "retention", heading: "Data Retention", text: "We keep your information for as long as your account is active and for a reasonable period afterward to meet legal and operational needs, then delete or anonymise it." },
      { id: "brokers", heading: "Business Partners", text: "We may disclose aggregated and pseudonymised audience segments to selected marketing partners and data brokers so they can reach similar audiences on our behalf." },
      { id: "rights", heading: "Your Rights", text: "Depending on where you live, you may request access to, correction of, or deletion of your personal data, and you may object to certain processing at any time." },
      { id: "children", heading: "Children", text: "The service is not directed to children under 13, and we do not knowingly collect personal information from them. If we learn we have, we delete it." },
      { id: "contact", heading: "Contact Us", text: "If you have questions about this policy or how your data is handled, you can reach our privacy team at privacy@example.com." },
    ],
  },
]
