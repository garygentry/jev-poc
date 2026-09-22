import type { FanOutManifest } from "@/demos/_kit/types"

import { RULE, SEARCHES, stateFor, type Search } from "./corpus"

/**
 * One question, asked once per function: does it match the rule?
 *
 * A Noul, because a match is held by degree and a threshold turns it into the
 * hit-or-not a search returns. The rule lives in the instructions rather than in
 * code, which is the whole point — it is a sentence a regex cannot be, and it is
 * judged against the meaning of each function, not its surface tokens.
 */
export const manifest: FanOutManifest<Search> = {
  slug: "semantic-grep",
  title: "Semantic grep",
  tagline: "Apply one semantic rule per function; threshold scores into hits",
  thesis:
    "Each function body is separate state for the same question: does it make a network request without a timeout? Code thresholds each probability at 0.6 and compares the hit with a regex, testing meaning-based matching across varied APIs and absent safeguards with one request per function and a cutoff that requires calibration.",
  group: "engineering",
  order: 4,
  kind: "fanout",
  shape: {
    questions: "1",
    states: "one per function",
    requests: "fanned out, capped",
  },
  primitives: ["noul"],

  questions: {
    matches: {
      type: "noul",
      instructions: `Judge this function against the rule: "${RULE}"`,
      criteria: {
        true: "The function makes a network request and no timeout is configured for it, by any means.",
        false:
          "It makes no network request, or it makes one but a timeout is set (an option, a signal, or a call like setTimeout).",
      },
    },
  },

  examples: SEARCHES.map((search) => ({
    id: search.id,
    label: search.label,
    input: search,
  })),

  itemsFor: (search) =>
    search.functions.map((fn) => ({ id: fn.id, state: stateFor(fn) })),

  estimateCalls: (search) => search.functions.length,
}
