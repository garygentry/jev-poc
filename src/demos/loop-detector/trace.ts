import type { JevState } from "@shared/jev.ts"

/** One step of an agent run: what it did, and what came back. */
export interface Step {
  action: string
  result: string
}

export interface Trace {
  id: string
  label: string
  /** What the agent is working toward. Progress is judged against it. */
  goal: string
  steps: Step[]
}

/**
 * The window geometry, in one place so the manifest, the policy and the view
 * all slice the trace the same way.
 *
 * Three steps is the smallest window that can tell "circling" from "a slow
 * step": two steps can look repetitive by chance, three that repeat are a
 * pattern. A stride of one means every step is the leading edge of a window, so
 * the onset of a loop is located to the step, not to the window.
 */
export const WINDOW = 3
export const STRIDE = 1

/** One step as a single line, the form the gate reads. */
export const stepLine = (step: Step): string => `${step.action} → ${step.result}`

export interface Window {
  id: string
  /** 1-based number of the first step in the window. */
  startStep: number
  steps: Step[]
}

/**
 * Slide the window over a trace.
 *
 * The id is the window's first step (`w6` starts at step 6), which is also the
 * fixture key `pnpm capture` records it under — so the recording and the UI
 * name the same slice, and the onset the policy reports is a real step number.
 */
export const windowsOf = (trace: Trace): Window[] => {
  const windows: Window[] = []
  for (let i = 0; i + WINDOW <= trace.steps.length; i += STRIDE) {
    windows.push({
      id: `w${i + 1}`,
      startStep: i + 1,
      steps: trace.steps.slice(i, i + WINDOW),
    })
  }
  return windows
}

/**
 * What the gate judges: the goal, and the steps of one window, together.
 *
 * The goal rides in every window because "no progress" is meaningless without
 * something to progress toward — bumping a timeout is circling against "fix the
 * flaky test" and diligence against "raise the timeout". Only the window's own
 * steps are sent, never the whole trace: the point of a window is that a stuck
 * stretch is legible from a few steps, without paying to re-read the run.
 */
export const stateFor = (goal: string, steps: Step[]): JevState => ({
  goal,
  steps: steps.map(stepLine),
})

/**
 * Four agent runs, chosen to break a max-iteration counter in both directions.
 *
 * A counter cuts at a fixed step regardless of what the steps say: it kills
 * `steady-progress` mid-stride and lets `debug-loop` and `tight-loop` circle
 * until they hit the cap. `recovers` is the false-positive guard — a short
 * stall that breaks out on its own, which a detector must *not* flag, or it
 * would cut runs as bluntly as the counter it replaces.
 */
export const TRACES: Trace[] = [
  {
    id: "debug-loop",
    label: "Debug — progresses, then loops",
    goal: "Fix the failing test_checkout (returns 500) and get the suite green.",
    steps: [
      { action: "Run test_checkout", result: "fails with a 500" },
      { action: "Read the server log for the 500", result: "traces to charge() raising KeyError 'currency'" },
      { action: "Open payments/charge.py", result: "currency is read from order.meta, which is sometimes absent" },
      { action: "Default the currency: order.meta.get('currency', account.currency)", result: "re-run test_checkout — still 500, KeyError 'currency'" },
      { action: "Re-read payments/charge.py", result: "the default line is there; re-run — still 500, KeyError 'currency'" },
      { action: "Add a print of order.meta before the read", result: "re-run — still 500, KeyError 'currency'; the print never showed" },
      { action: "Re-read payments/charge.py again", result: "looks correct; re-run test_checkout — still 500, KeyError 'currency'" },
      { action: "Clear the pytest cache and re-run", result: "still 500, KeyError 'currency'" },
      { action: "Re-read payments/charge.py once more", result: "re-run — still 500, KeyError 'currency'" },
      { action: "Add the currency default line again", result: "re-run test_checkout — still 500, KeyError 'currency'" },
      { action: "Re-read the server log", result: "same KeyError 'currency'; re-run — still 500" },
      { action: "Re-read payments/charge.py", result: "re-run test_checkout — still 500, KeyError 'currency'" },
    ],
  },
  {
    id: "steady-progress",
    label: "Refactor — long but always advancing",
    goal: "Migrate every call site of format_date to a timezone-aware version and keep the suite green.",
    steps: [
      { action: "Grep for format_date call sites", result: "14 calls across 6 files" },
      { action: "Read the current format_date", result: "uses strftime with no timezone" },
      { action: "Write format_date(dt, tz) using zoneinfo", result: "new signature in place" },
      { action: "Add unit tests for the tz-aware output", result: "3 new tests, all green" },
      { action: "Migrate the 4 call sites in billing/", result: "billing tests green" },
      { action: "Migrate the 3 call sites in reports/", result: "reports tests green" },
      { action: "Migrate the 5 call sites in api/", result: "one handler needs a tz threaded through" },
      { action: "Thread tz through the api handler", result: "api tests green" },
      { action: "Migrate the last 2 call sites in exports/", result: "exports tests green" },
      { action: "Remove the old strftime helper", result: "grep confirms no remaining callers" },
      { action: "Run the full suite", result: "212 passed" },
      { action: "Update the changelog", result: "migration complete" },
    ],
  },
  {
    id: "recovers",
    label: "Stalls briefly, then breaks out",
    goal: "Get `import app` working and the suite passing.",
    steps: [
      { action: "Run the suite", result: "collection fails: ModuleNotFoundError 'redis'" },
      { action: "Add redis to requirements and reinstall", result: "re-run — still ModuleNotFoundError 'redis'" },
      { action: "Reinstall the requirements again", result: "re-run — still ModuleNotFoundError 'redis'" },
      { action: "Reinstall once more", result: "re-run — still ModuleNotFoundError 'redis'" },
      { action: "Print sys.executable inside the test run", result: "it points at the system Python, not the project venv" },
      { action: "Activate the project venv and reinstall", result: "import app now succeeds" },
      { action: "Run the suite", result: "3 tests fail on a redis connection refused" },
      { action: "Start a local redis and re-run", result: "connection ok; 1 test still fails on a serialization error" },
      { action: "Open the serializer and fix the datetime handling", result: "re-run — the failing test passes" },
      { action: "Run the full suite", result: "all green" },
    ],
  },
  {
    id: "tight-loop",
    label: "Loops from the second step",
    goal: "Make the flaky test_upload pass reliably.",
    steps: [
      { action: "Run test_upload", result: "fails: timeout after 30s" },
      { action: "Raise the test timeout to 60s", result: "re-run — fails: timeout after 60s" },
      { action: "Raise the test timeout to 120s", result: "re-run — fails: timeout after 120s" },
      { action: "Raise the test timeout to 300s", result: "re-run — fails: timeout after 300s" },
      { action: "Raise the test timeout to 600s", result: "re-run — fails: timeout after 600s" },
      { action: "Raise the test timeout to 900s", result: "re-run — fails: timeout after 900s" },
      { action: "Raise the test timeout to 1200s", result: "re-run — fails: timeout after 1200s" },
      { action: "Raise the test timeout to 1800s", result: "re-run — fails: timeout after 1800s" },
      { action: "Raise the test timeout to 3600s", result: "re-run — fails: timeout after 3600s" },
      { action: "Raise the test timeout to 7200s", result: "re-run — fails: timeout after 7200s" },
      { action: "Raise the test timeout again", result: "re-run — fails: timeout" },
      { action: "Raise the test timeout once more", result: "re-run — fails: timeout" },
    ],
  },
]
