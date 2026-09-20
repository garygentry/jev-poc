import type { FanOutManifest } from "@/demos/_kit/types"

import { SCENARIOS, stateFor, type Scenario } from "./context"

/**
 * One question, asked once per chunk: does this block earn its place in the
 * context for *this* goal?
 *
 * A Noul rather than a Choice, because keeping a chunk is a yes/no you want to
 * act on by degree, and a probability is exactly what a threshold turns into a
 * keep-or-drop decision. The explicit `false` names the failure mode a keyword
 * filter cannot see: a chunk that shares the goal's vocabulary without bearing
 * on it.
 */
export const manifest: FanOutManifest<Scenario> = {
  slug: "context-pruner",
  title: "Context pruner",
  tagline: "The saving is the tokens you never send",
  thesis:
    "The other half of the control plane's cost story. Instead of stuffing an agent's whole context into every expensive call — or truncating it blindly — Jev judges each chunk against the goal for a fraction of a cent, and only what earns its place is sent on.",
  group: "control-plane",
  order: 2,
  kind: "fanout",
  shape: {
    questions: "1",
    states: "one per chunk",
    requests: "fanned out, capped",
  },
  primitives: ["noul"],

  questions: {
    relevant: {
      type: "noul",
      instructions:
        "An agent is working towards `goal` and has retrieved `chunk`. Does this chunk carry information that bears on the goal, such that dropping it would cost the agent something it needs?",
      criteria: {
        true: "The chunk contains a fact, constraint or step that helps achieve the goal — keeping it earns its tokens.",
        false:
          "The chunk is off-topic, or merely shares words with the goal without bearing on it: boilerplate, a different incident, unrelated docs.",
      },
    },
  },

  examples: SCENARIOS.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    input: scenario,
  })),

  /** One chunk is one state — which is precisely why these cannot batch. */
  itemsFor: (scenario) =>
    scenario.chunks.map((chunk) => ({
      id: chunk.id,
      state: stateFor(scenario.goal, chunk),
    })),

  estimateCalls: (scenario) => scenario.chunks.length,
}
