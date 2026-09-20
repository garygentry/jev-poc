import { lazy } from "react"

import type { Demo } from "./registry"

/**
 * The demos that have not been migrated onto the kit yet.
 *
 * **This file is temporary and is deleted when the migration finishes.** The
 * registry discovers demos by looking for `<slug>/demo.ts`, and a demo that
 * still keeps its metadata here rather than in a manifest would simply vanish
 * from the gallery mid-migration. Rather than move all eight at once and find
 * out whether the kit was right only at the end, each demo moves out of this
 * list as it is converted, and the list is expected to empty.
 *
 * Nothing new goes in here.
 */
export const LEGACY_DEMOS: Demo[] = [
  {
    slug: "guardrail",
    title: "Command guardrail",
    tagline: "The agent permission gate, in the open",
    thesis:
      "Confidence thresholds scale to the stakes of the branch they guard. Misrouting a read-only command is free; waving through a destructive one is not, so they cannot share a cutoff.",
    group: "foundations",
    order: 2,
    shape: { questions: "6", states: "1", requests: "1" },
    primitives: ["choice", "score", "noul"],
    fansOut: false,
    Component: lazy(() => import("./guardrail/Demo")),
  },
  {
    slug: "rerank",
    title: "Semantic re-rank",
    tagline: "Probability as a sort key",
    thesis:
      "The mirror image of triage. Every candidate is different state, so the questions cannot batch — the calls fan out instead, and the returned probability sorts.",
    group: "foundations",
    order: 3,
    shape: { questions: "1", states: "24", requests: "24 concurrent" },
    primitives: ["noul"],
    fansOut: true,
    Component: lazy(() => import("./rerank/Demo")),
  },
  {
    slug: "typewriter",
    title: "Live typewriter",
    tagline: "Twelve judgements, repainting as you type",
    thesis:
      "What ~100ms buys you. Twelve questions re-answer on every pause in typing, which is a thing you simply cannot build against a model that streams prose.",
    group: "foundations",
    order: 4,
    shape: { questions: "12", states: "1", requests: "1 per pause" },
    primitives: ["choice", "score", "noul"],
    fansOut: false,
    Component: lazy(() => import("./typewriter/Demo")),
  },
  {
    slug: "taxonomy",
    title: "Taxonomy beam search",
    tagline: "Read the distribution, not the winner",
    thesis:
      "Beam search over a taxonomy, carrying several live branches down each level. It only works because the probabilities are calibrated and comparable — an uncalibrated top-1 tells you nothing about whether branch two was nearly as good.",
    group: "foundations",
    order: 5,
    shape: { questions: "1 per live branch", states: "1", requests: "1 per level" },
    primitives: ["choice"],
    fansOut: false,
    Component: lazy(() => import("./taxonomy/Demo")),
  },
  {
    slug: "router",
    title: "Model router",
    tagline: "Spend a hundredth of a cent to save a dollar",
    thesis:
      "The control plane around an agent. Jev picks the cheapest model that can do the job, and its own cost is a rounding error against the difference.",
    group: "foundations",
    order: 6,
    shape: { questions: "6", states: "1", requests: "1" },
    primitives: ["choice", "noul"],
    fansOut: false,
    Component: lazy(() => import("./router/Demo")),
  },
  {
    slug: "bulk",
    title: "Bulk labelling",
    tagline: "Free output tokens change the arithmetic",
    thesis:
      "Classification at a price where you stop rationing it. The interesting output is not the labels but the low-confidence queue: the rows Jev declined to call, routed to a human.",
    group: "foundations",
    order: 7,
    shape: { questions: "4", states: "up to 200", requests: "8 at a time" },
    primitives: ["choice", "score", "noul"],
    fansOut: true,
    Component: lazy(() => import("./bulk/Demo")),
  },
  {
    slug: "personas",
    title: "Persona panel",
    tagline: "One message, twelve readers, one distribution",
    thesis:
      "Probability across a population rather than an argmax over options. Where the panel splits is the signal, and it is a shape a chat model handles badly.",
    group: "foundations",
    order: 8,
    shape: { questions: "2", states: "12", requests: "12 concurrent" },
    primitives: ["noul", "score"],
    fansOut: true,
    Component: lazy(() => import("./personas/Demo")),
  },
]
