import { lazy, type LazyExoticComponent, type ComponentType } from "react"

export type Primitive = "choice" | "score" | "noul"

export interface DemoShape {
  /** How many questions ride in one request. */
  questions: string
  /** How many distinct states are judged. */
  states: string
  /** How many upstream calls that works out to. */
  requests: string
}

export interface Demo {
  slug: string
  title: string
  tagline: string
  /** The one thing this demo exists to show. */
  thesis: string
  shape: DemoShape
  primitives: Primitive[]
  /** True for the demos that fan out and can therefore spend real money. */
  fansOut?: boolean
  Component: LazyExoticComponent<ComponentType>
}

/**
 * The eight demos, ordered as a tour.
 *
 * Each one is a different *shape*, not a different topic. Questions batch into
 * a single request only when they share state — so a demo that fans questions
 * wide and a demo that fans requests wide are teaching two genuinely different
 * things, and a set that only showed the first would miss half the model.
 */
export const demos: Demo[] = [
  {
    slug: "triage",
    title: "Ticket triage",
    tagline: "Seven narrow questions beat one broad prompt",
    thesis:
      "Decomposition. Seven questions over one ticket cost roughly one question's wall-clock, and the routing policy stays in TypeScript where it can be read, tested and retuned without touching the model.",
    shape: { questions: "7", states: "1", requests: "1" },
    primitives: ["choice", "score", "noul"],
    Component: lazy(() => import("./triage/Demo")),
  },
  {
    slug: "guardrail",
    title: "Command guardrail",
    tagline: "The agent permission gate, in the open",
    thesis:
      "Confidence thresholds scale to the stakes of the branch they guard. Misrouting a read-only command is free; waving through a destructive one is not, so they cannot share a cutoff.",
    shape: { questions: "6", states: "1", requests: "1" },
    primitives: ["choice", "score", "noul"],
    Component: lazy(() => import("./guardrail/Demo")),
  },
  {
    slug: "rerank",
    title: "Semantic re-rank",
    tagline: "Probability as a sort key",
    thesis:
      "The mirror image of triage. Every candidate is different state, so the questions cannot batch — the calls fan out instead, and the returned probability sorts.",
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
    shape: { questions: "12", states: "1", requests: "1 per pause" },
    primitives: ["choice", "score", "noul"],
    Component: lazy(() => import("./typewriter/Demo")),
  },
  {
    slug: "taxonomy",
    title: "Taxonomy beam search",
    tagline: "Read the distribution, not the winner",
    thesis:
      "Beam search over a taxonomy, carrying several live branches down each level. It only works because the probabilities are calibrated and comparable — an uncalibrated top-1 tells you nothing about whether branch two was nearly as good.",
    shape: { questions: "1 per live branch", states: "1", requests: "1 per level" },
    primitives: ["choice"],
    Component: lazy(() => import("./taxonomy/Demo")),
  },
  {
    slug: "router",
    title: "Model router",
    tagline: "Spend a hundredth of a cent to save a dollar",
    thesis:
      "The control plane around an agent. Jev picks the cheapest model that can do the job, and its own cost is a rounding error against the difference.",
    shape: { questions: "6", states: "1", requests: "1" },
    primitives: ["choice", "noul"],
    Component: lazy(() => import("./router/Demo")),
  },
  {
    slug: "bulk",
    title: "Bulk labelling",
    tagline: "Free output tokens change the arithmetic",
    thesis:
      "Classification at a price where you stop rationing it. The interesting output is not the labels but the low-confidence queue: the rows Jev declined to call, routed to a human.",
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
    shape: { questions: "2", states: "12", requests: "12 concurrent" },
    primitives: ["noul", "score"],
    fansOut: true,
    Component: lazy(() => import("./personas/Demo")),
  },
]

export const demoBySlug = (slug: string) =>
  demos.find((demo) => demo.slug === slug)
