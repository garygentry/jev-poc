import { PolicyTrace } from "@/components/jev/PolicyTrace"
import { DemoScaffold, useBaseline, useSingleRun } from "@/demos/_kit"

import { manifest } from "./demo"
import { checkDone } from "./policy"
import { DoneMatrix, MeasuredComparison, TaskCard } from "./view"

export default function DoneCheckDemo() {
  const run = useSingleRun(manifest)

  // The measured baseline runs the same question set through a chat model, so it
  // needs the same state the gate saw. Guarded inside the hook: a result for the
  // previous task is dropped the moment a new one is selected.
  const state = manifest.stateFor(run.input)
  const baseline = useBaseline(manifest.questions, state)

  return (
    <DemoScaffold manifest={manifest} run={run} policy={checkDone}>
      {({ input, verdict, run: envelope }) => (
        <>
          <TaskCard task={input} />
          {verdict ? (
            <>
              <DoneMatrix check={verdict} />
              <MeasuredComparison
                baseline={baseline}
                check={verdict}
                gateUsage={envelope.source === "live" ? envelope.usage : undefined}
                gateLatencyMs={
                  envelope.source === "live" ? envelope.latencyMs : undefined
                }
                live={envelope.source === "live"}
              />
              <PolicyTrace lines={verdict.trace} />
            </>
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
