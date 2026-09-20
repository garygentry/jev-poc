import type { FanOutManifest } from "@/demos/_kit/types"

import { TRACES, stateFor, windowsOf, type Trace } from "./trace"

/**
 * One question, asked once per window: across these steps, is the agent circling
 * or advancing?
 *
 * A Noul, because "stuck" is a matter of degree a threshold turns into a call,
 * and because the useful signal is a *run* of high answers, not one. It is
 * pinned to the concrete distinction a step counter cannot make — the same
 * approach meeting the same result, versus new ground each step — so that
 * bumping a timeout ten times reads as circling while ten different migrations
 * read as progress, even though a counter sees ten steps either way.
 */
export const manifest: FanOutManifest<Trace> = {
  slug: "loop-detector",
  title: "Loop detector",
  tagline: "Read 'no progress' off the trace, instead of counting steps",
  thesis:
    "A max-iteration counter cuts a good long run short and lets a bad one burn to the cap, because it counts steps without reading them. A cheap noul over a sliding window reads whether the agent is circling — the same action meeting the same result — and stops a loop at its onset while never cutting a run that is still advancing.",
  group: "control-plane",
  order: 4,
  kind: "windowed",
  shape: {
    questions: "1",
    states: "one per window",
    requests: "fanned out, capped",
  },
  primitives: ["noul"],

  questions: {
    stuck: {
      type: "noul",
      instructions:
        "These are consecutive steps from an agent working toward the goal. Across this window, is the agent circling — repeating the same kind of action and meeting the same result — rather than making progress?",
      criteria: {
        true: "The steps repeat one approach and hit the same outcome; nothing new is tried, learned, or changed across the window.",
        false:
          "The steps make headway — each does something new, or learns something that moves the task forward, even if slowly.",
      },
    },
  },

  examples: TRACES.map((trace) => ({
    id: trace.id,
    label: trace.label,
    input: trace,
  })),

  /** One window is one state — a different slice of the trace, so they cannot batch. */
  itemsFor: (trace) =>
    windowsOf(trace).map((window) => ({
      id: window.id,
      state: stateFor(trace.goal, window.steps),
    })),

  estimateCalls: (trace) => windowsOf(trace).length,
}
