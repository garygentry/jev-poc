import { DemoScaffold, useBaseline, useSingleRun } from "@/demos/_kit"

import { manifest } from "./demo"
import { triageFailure } from "./policy"
import { ActionVerdict, FailureCard, MeasuredComparison } from "./view"

export default function FlakyTriageDemo() {
  const run = useSingleRun(manifest)

  const state = manifest.stateFor(run.input)
  const baseline = useBaseline(manifest.questions, state)

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      policy={triageFailure}
      answers={{ title: "The read" }}
    >
      {({ input, verdict, run: envelope }) => (
        <>
          <FailureCard failure={input} />
          {verdict ? (
            <>
              <ActionVerdict triage={verdict} />
              <MeasuredComparison
                baseline={baseline}
                questions={manifest.questions}
                jevAnswers={envelope.answers}
                gateUsage={envelope.source === "live" ? envelope.usage : undefined}
                gateLatencyMs={
                  envelope.source === "live" ? envelope.latencyMs : undefined
                }
                live={envelope.source === "live"}
              />
            </>
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
