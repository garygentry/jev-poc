import { useMemo } from "react"

import { DemoScaffold, useSingleRun } from "@/demos/_kit"

import { manifest, TASK_QUESTIONS } from "./demo"
import { TRUSTED_CONFIDENCE, chooseTier } from "./policy"
import { useCascadeWork } from "./useCascadeWork"
import { CascadeResult, RequestCard, TierVerdict } from "./view"

export default function CascadeDemo() {
  const run = useSingleRun(manifest)

  // The tier is needed here, above the scaffold's render prop, because the
  // worker hook runs at the top level. Guarded the same way the scaffold guards
  // its own verdict: a fixture from an older question set is dropped, not
  // thrown. The scaffold recomputes it from the same pure function for the
  // trace, so the two cannot drift.
  const cascade = useMemo(() => {
    if (!run.answers) return null
    try {
      return chooseTier(run.answers)
    } catch {
      return null
    }
  }, [run.answers])

  const state = manifest.stateFor(run.input)
  const work = useCascadeWork(cascade?.tier ?? null, TASK_QUESTIONS, state)

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      policy={chooseTier}
      answers={{
        title: "What the gate asked",
        thresholdFor: (name) =>
          name === "difficulty" ? TRUSTED_CONFIDENCE : undefined,
      }}
    >
      {({ input, verdict, run: envelope }) => (
        <>
          <RequestCard text={input.text} />
          {verdict ? (
            <>
              <TierVerdict cascade={verdict} />
              <CascadeResult
                work={work}
                cascade={verdict}
                gateUsage={envelope.source === "live" ? envelope.usage : undefined}
                gateLatencyMs={
                  envelope.source === "live" ? envelope.latencyMs : undefined
                }
                questions={TASK_QUESTIONS}
                live={envelope.source === "live"}
              />
            </>
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
