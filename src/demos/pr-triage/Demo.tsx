import { DemoScaffold, useBaseline, useSingleRun } from "@/demos/_kit"

import { manifest } from "./demo"
import { triage } from "./policy"
import { MeasuredComparison, PrCard, ReviewVerdict } from "./view"

export default function PrTriageDemo() {
  const run = useSingleRun(manifest)

  const state = manifest.stateFor(run.input)
  const baseline = useBaseline(manifest.questions, state)

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      policy={triage}
      answers={{ title: "The risk read" }}
    >
      {({ input, verdict, run: envelope }) => (
        <>
          <PrCard pr={input} />
          {verdict ? (
            <>
              <ReviewVerdict triage={verdict} />
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
