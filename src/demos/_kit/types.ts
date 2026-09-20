/**
 * What a demo declares about itself.
 *
 * **This file must stay free of JSX and of anything that imports React.**
 * `scripts/capture.ts` and the Playwright config both run under Node and need
 * every demo's questions, examples and states without pulling a renderer in
 * behind them. That is why a demo's manifest lives in `demo.ts` and its view in
 * `Demo.tsx`, and why the dependency only ever points one way: `Demo.tsx`
 * imports the manifest, never the reverse.
 */
import type { JevQuestionSet, JevState } from "@shared/jev.ts"

/**
 * How a demo turns input into upstream calls.
 *
 * This is the organising idea of the whole tour: questions batch into one
 * request *only when they share a state*. Everything below is a consequence of
 * that single rule, which is why the kind is a first-class property rather than
 * an implementation detail of each demo.
 */
export type DemoKind =
  /** One state, N questions, one request. */
  | "single"
  /** N states, one shared question set, fanned out under the server's cap. */
  | "fanout"
  /** Blocked N×N comparisons, then fanned out. */
  | "pairwise"
  /** Sequential; each round's questions are built from the last round's answers. */
  | "rounds"
  /** A sliding window over one input too long for the context, then aggregated. */
  | "windowed"
  /** A Jev gate, then optionally an expensive model. */
  | "cascade"
  /** No calls at all; operates on answers that were already recorded. */
  | "offline"

export type DemoGroup =
  /**
   * The original eight. They are named for the *shape* each one teaches rather
   * than for a domain, which is what makes them the tour and not a feature list.
   */
  | "foundations"
  | "control-plane"
  | "cost"
  | "engineering"
  | "safety"
  | "documents"
  | "method"

/** Demos whose cost grows with the size of their input, and are badged for it. */
const FANS_OUT: ReadonlySet<DemoKind> = new Set<DemoKind>([
  "fanout",
  "pairwise",
  "windowed",
])

export const fansOut = (kind: DemoKind): boolean => FANS_OUT.has(kind)

export type Primitive = "choice" | "score" | "noul"

export interface DemoShape {
  /** How many questions ride in one request. */
  questions: string
  /** How many distinct states are judged. */
  states: string
  /** How many upstream calls that works out to. */
  requests: string
}

/**
 * What this demo displaces, and what that costs today.
 *
 * Deliberately a *stated assumption* rather than a measurement: it is a price
 * or a wage read somewhere on a date, and it will go stale. Anything built on
 * it has to show `source` in the same card, so a ratio can never be read
 * without the number it rests on.
 */
export interface Displacement {
  /** e.g. "one Haiku 4.5 call per item". */
  baseline: string
  unit: "item" | "request" | "human-minute"
  /** USD per unit. */
  baselineUsd: number
  /** Where the number came from, and when it was read. */
  source: string
}

export interface DemoExample<TInput> {
  id: string
  label: string
  input: TInput
}

export interface DemoManifest<TInput = unknown> {
  slug: string
  title: string
  tagline: string
  /** The one thing this demo exists to show. */
  thesis: string
  group: DemoGroup
  /** Position within the group. Groups are ordered by the registry. */
  order: number
  kind: DemoKind
  shape: DemoShape
  primitives: Primitive[]
  displaces?: Displacement
  questions: JevQuestionSet
  examples: Array<DemoExample<TInput>>
  /** The literal state posted to Jev for one example. */
  stateFor: (input: TInput) => JevState
  /**
   * Upstream calls one run of this example costs.
   *
   * Feeds the projected-cost readout the UI shows *before* a fan-out runs, and
   * the capture budget. A demo that cannot spend more than one call still
   * declares it, so neither caller needs a special case.
   */
  estimateCalls: (input: TInput) => number
}

/**
 * A manifest whose input type has been erased.
 *
 * The registry and the capture script hold manifests of every demo at once, and
 * those inputs have nothing in common — a ticket, a shell command, a passage.
 * Both only ever feed an example's own input back into its own manifest, which
 * is safe but is not a thing the type system can be told. `unknown` would make
 * `stateFor` uncallable and `never` would make `examples` unassignable, so the
 * escape hatch is deliberate and is confined to this alias.
 *
 * Anything that knows which demo it is dealing with should take
 * `DemoManifest<T>` instead and stay typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDemoManifest = DemoManifest<any>
