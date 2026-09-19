export interface Draft {
  id: string
  label: string
  text: string
}

/**
 * Three pitches for the same product, chosen to produce different *shapes* of
 * panel rather than different scores.
 *
 * The first two land at almost the same mean and could not be more different
 * underneath, which is the comparison the demo exists to make.
 */
export const DRAFTS: Draft[] = [
  {
    id: "technical",
    label: "Technical pitch",
    text: "Jev returns typed decisions with calibrated probabilities in about 100ms, at $0.042 per million input tokens with output free. No parsing step, no free-text-to-struct failure mode — you get a choice, a score or a probability that your code branches on directly.",
  },
  {
    id: "outcome",
    label: "Outcome pitch",
    text: "Stop paying a frontier model to answer yes-or-no questions. Route tickets, gate risky tool calls and label your backlog for a fraction of a cent each, and put the savings into the work that actually needs a large model.",
  },
  {
    id: "hype",
    label: "Hype pitch",
    text: "The era of waiting for tokens is over. A new class of model is here, and it is going to change everything about how software makes decisions. Join the thousands of developers already building the future.",
  },
]
