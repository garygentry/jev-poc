import type { SingleManifest } from "@/demos/_kit/types"

import { CONTENTS, stateFor, type Content } from "./content"
import { POLICIES, buildQuestions } from "./policies"

/**
 * Twelve policies, one piece of content, one request.
 *
 * This is the batching rule at its clearest: because every policy asks about the
 * same state, all twelve ride in a single call. A chat baseline either sends one
 * prompt per policy — twelve requests — or crams all twelve into one long prompt
 * that grows fragile as it grows. Here the twelve are just a question set, and
 * each keeps its own threshold instead of being flattened into one.
 */
export const manifest: SingleManifest<Content> = {
  slug: "moderation",
  title: "Multi-policy moderation",
  tagline: "Evaluate twelve policies on one message; route with code",
  thesis:
    "One message is the shared state for twelve condition-probability questions in a single request. Code applies a separate threshold to each policy, then reduces triggered policies to allow, review, or block, testing batched typed judgments while keeping the final action outside the model.",
  group: "safety",
  order: 1,
  kind: "single",
  shape: { questions: "12", states: "1", requests: "1" },
  primitives: ["noul"],

  displaces: {
    baseline: "one moderation prompt per policy",
    unit: "request",
    baselineUsd: 0.0008,
    source: "measured Haiku 4.5 cost per structured call, this repo, 2026-09-20",
  },

  questions: buildQuestions(),

  examples: CONTENTS.map((content) => ({
    id: content.id,
    label: content.label,
    input: content,
  })),

  stateFor,

  // One request carries all twelve policies — the figure the demo exists to make.
  estimateCalls: () => 1,
}

// Re-exported so the view and policy read the same twelve without re-importing.
export { POLICIES }
