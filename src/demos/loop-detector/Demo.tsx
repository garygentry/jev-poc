import { useMemo } from "react"

import { DemoScaffold, useWindowed } from "@/demos/_kit"

import { manifest } from "./demo"
import { detectLoop, type LoopReport } from "./policy"
import { windowsOf } from "./trace"
import { GoalCard, Timeline, Verdict } from "./view"

const wireNote = (windows: number) =>
  `${windows} separate requests — one per window over the trace. Shown: the first.`

export default function LoopDetectorDemo() {
  const run = useWindowed(manifest, { wireNote })
  const { input: trace, results } = run

  // Join each window's `stuck` answer back to the step it starts on, in order,
  // then read the loop off the run of them. A window the fan-out has no row for
  // yet carries an undefined answer, which `detectLoop` treats as not-stuck.
  const report = useMemo<LoopReport | null>(() => {
    if (!results) return null
    const byId = new Map(results.map((row) => [row.id, row]))
    const windows = windowsOf(trace).map((w) => ({
      startStep: w.startStep,
      answer: byId.get(w.id)?.answers?.stuck,
    }))
    return detectLoop(windows, trace.steps.length)
  }, [trace, results])

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Read ${windowsOf(trace).length} windows`}
    >
      {() => (
        <>
          <GoalCard goal={trace.goal} />
          {report ? (
            <Verdict
              report={report}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              calls={run.calls}
              source={run.source}
            />
          ) : null}
          <Timeline trace={trace} report={report} loading={run.loading} />
        </>
      )}
    </DemoScaffold>
  )
}
