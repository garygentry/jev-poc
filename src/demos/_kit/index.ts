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
export type { PolicyResult, ScaffoldRender } from "./DemoScaffold"
export { entryKey, fixtureKey } from "./fixtures"
export { useSingleRun } from "./runners/useSingleRun"
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
  Primitive,
} from "./types"
