/**
 * The demo kit.
 *
 * A demo is a directory: a JSX-free `demo.ts` manifest, a pure `policy.ts` with
 * its tests, and a `Demo.tsx` holding only the view that is peculiar to it.
 * Everything else — discovery, the frame, the run bar, fixture keys, the answer
 * column, the trace and the wire panel — comes from here, and adding a demo
 * edits no central file.
 *
 * `load-manifests.ts` is deliberately **not** re-exported: it is the Node-side
 * loader, and pulling it in through this barrel would put `node:fs` into the
 * browser bundle.
 */
export { DemoScaffold } from "./DemoScaffold"
export type {
  AnswerColumn,
  PolicyResult,
  ScaffoldRender,
} from "./DemoScaffold"
export { entryKey, fixtureKey, roundKey } from "./fixtures"
export { useBaseline } from "./runners/useBaseline"
export type { BaselineController } from "./runners/useBaseline"
export { useFanOut } from "./runners/useFanOut"
export type { FanOutEnvelope } from "./runners/useFanOut"
export { useLiveRun } from "./runners/useLiveRun"
export type { LiveEnvelope } from "./runners/useLiveRun"
export { useRounds } from "./runners/useRounds"
export type { RoundsEnvelope } from "./runners/useRounds"
export { useSingleRun } from "./runners/useSingleRun"
export { useWindowed } from "./runners/useWindowed"
export type { WindowedEnvelope } from "./runners/useWindowed"
export type { RunEnvelope, RunnerOptions } from "./runners/types"
export { fansOut } from "./types"
export type {
  AnyDemoManifest,
  DemoExample,
  DemoGroup,
  DemoKind,
  DemoManifest,
  DemoShape,
  Displacement,
  FanOutManifest,
  OfflineManifest,
  RoundsManifest,
  RoundsSpec,
  Primitive,
  SingleManifest,
} from "./types"
