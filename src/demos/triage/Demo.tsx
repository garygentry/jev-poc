import { DemoScaffold, useSingleRun } from "@/demos/_kit"

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

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      policy={route}
      thresholdFor={departmentGate}
      answersTitle="Seven answers, one request"
      preview={(ticket) => <TicketCard ticket={ticket} />}
    >
      {({ verdict }) => (verdict ? <Verdict routed={verdict} /> : null)}
    </DemoScaffold>
  )
}
