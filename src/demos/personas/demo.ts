import type { FanOutManifest } from "@/demos/_kit/types"

import { PERSONAS, stateFor } from "./personas"

/** The message under test. Editable, so it is not always one of the examples. */
export interface Draft {
  text: string
}

/**
 * Two questions, asked once per reader.
 *
 * The output you want here is not an argmax — it is the *spread*. Twelve
 * probabilities that all sit near 0.8 say something different from six near 0.95
 * and six near 0.1, and the mean is identical in both cases. Reading the
 * distribution across a population is the shape this demo exists to show.
 */
export const manifest: FanOutManifest<Draft> = {
  slug: "personas",
  title: "Persona panel",
  tagline: "Run one message against twelve explicit reader states",
  thesis:
    "Each invented persona supplies separate state for the same message. Jev returns an action probability and reception score per reader; code measures the spread and flags opposing groups, demonstrating multi-state evaluation without treating simulated readers as user research.",
  group: "foundations",
  order: 8,
  kind: "fanout",
  shape: {
    questions: "2",
    states: String(PERSONAS.length),
    requests: `${PERSONAS.length} concurrent`,
  },
  primitives: ["noul", "score"],

  questions: {
    would_act: {
      type: "noul",
      instructions:
        "Given who `reader` is and what they care about, would this reader take the next step this `message` is asking for?",
      criteria: {
        true: "The message addresses something this particular reader is trying to achieve, in terms they would find credible.",
        false:
          "The message is fine in general but does not connect to this reader's priorities, or asks them to trust a claim they would discount.",
      },
    },

    lands: {
      type: "score",
      instructions: "How well the message lands with this specific reader.",
      criteria: [
        "Actively puts them off — wrong register, or triggers their scepticism.",
        "Bounces off; they would not finish reading it.",
        "Holds their attention but leaves their main question unanswered.",
        "Speaks directly to what they care about and answers it.",
      ],
    },
  },

  /**
   * Three pitches for the same product, chosen to produce different *shapes* of
   * panel rather than different scores.
   *
   * The first two land at almost the same mean and could not be more different
   * underneath, which is the comparison the demo exists to make.
   */
  examples: [
    {
      id: "technical",
      label: "Technical pitch",
      input: {
        text: "Jev returns typed decisions with calibrated probabilities in about 100ms, at $0.042 per million input tokens with output free. No parsing step, no free-text-to-struct failure mode — you get a choice, a score or a probability that your code branches on directly.",
      },
    },
    {
      id: "outcome",
      label: "Outcome pitch",
      input: {
        text: "Stop paying a frontier model to answer yes-or-no questions. Route tickets, gate risky tool calls and label your backlog for a fraction of a cent each, and put the savings into the work that actually needs a large model.",
      },
    },
    {
      id: "hype",
      label: "Hype pitch",
      input: {
        text: "The era of waiting for tokens is over. A new class of model is here, and it is going to change everything about how software makes decisions. Join the thousands of developers already building the future.",
      },
    },
  ],

  /** One reader is one state — twelve readers cannot share a request. */
  itemsFor: (draft) =>
    PERSONAS.map((persona) => ({
      id: persona.id,
      state: stateFor(persona, draft.text),
    })),

  estimateCalls: () => PERSONAS.length,
}
