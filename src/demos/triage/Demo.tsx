import { Baseline } from "@/components/jev/Baseline"
import { Displacement } from "@/components/jev/Displacement"
import { DemoScaffold, useBaseline, useSingleRun } from "@/demos/_kit"

import { manifest } from "./demo"
import { BILLING_CONFIDENCE, ROUTABLE_CONFIDENCE, route } from "./policy"
import { TicketCard, Verdict } from "./view"

import type { JevAnswer } from "@shared/jev.ts"

/** Which of the policy's two gates this answer is actually being held to. */
function departmentGate(name: string, answers: Record<string, JevAnswer>) {
  if (name !== "department") return undefined
  const department = answers.department
  if (department?.type !== "choice") return undefined
  return department.choice === "billing"
    ? BILLING_CONFIDENCE
    : ROUTABLE_CONFIDENCE
}

export default function TriageDemo() {
  const run = useSingleRun(manifest)
  const baseline = useBaseline(manifest.questions, manifest.stateFor(run.input))

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      policy={route}
      answers={{
        title: "Seven answers, one request",
        thresholdFor: departmentGate,
      }}
    >
      {({ input, answers, verdict, run }) => (
        <>
          <TicketCard ticket={input} />
          {verdict ? <Verdict routed={verdict} /> : null}
          {manifest.displaces ? (
            <Displacement
              displaces={manifest.displaces}
              usage={run.usage}
              latencyMs={run.latencyMs}
              calls={run.calls}
              source={run.source}
            />
          ) : null}
          <Baseline
            controller={baseline}
            questions={manifest.questions}
            jevAnswers={answers}
            jevUsage={run.usage}
            jevLatencyMs={run.latencyMs}
            source={run.source}
          />
        </>
      )}
    </DemoScaffold>
  )
}
