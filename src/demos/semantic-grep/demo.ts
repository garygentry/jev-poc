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
  tagline: "Search by a rule stated in English — the regex nobody can write",
  thesis:
    "Some searches cannot be a regex: 'a network call without a timeout' has a dozen syntaxes and turns on what is absent. One cheap noul per function judges each against the rule in plain English — finding the calls a pattern misses and skipping the ones it would flag for setting a timeout it cannot see.",
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
