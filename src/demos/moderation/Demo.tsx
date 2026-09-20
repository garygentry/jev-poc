import { PolicyTrace } from "@/components/jev/PolicyTrace"
import { DemoScaffold, useBaseline, useSingleRun } from "@/demos/_kit"

import { manifest } from "./demo"
import { moderate } from "./policy"
import { ContentCard, MeasuredComparison, PolicyMatrix, Verdict } from "./view"

export default function ModerationDemo() {
  const run = useSingleRun(manifest)

  const state = manifest.stateFor(run.input)
  const baseline = useBaseline(manifest.questions, state)

  return (
    <DemoScaffold manifest={manifest} run={run} policy={moderate}>
      {({ input, verdict, run: envelope }) => (
        <>
          <ContentCard content={input} />
          {verdict ? (
            <>
              <Verdict moderation={verdict} />
              <PolicyMatrix decisions={verdict.decisions} />
              <MeasuredComparison
                baseline={baseline}
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
