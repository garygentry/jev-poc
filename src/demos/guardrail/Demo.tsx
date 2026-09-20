import { DemoScaffold, useSingleRun } from "@/demos/_kit"

import { manifest } from "./demo"
import { RADIUS_POLICY, rule } from "./policy"
import { CommandCard, GateTable, VerdictCard } from "./view"

import type { JevAnswer } from "@shared/jev.ts"

/**
 * The gate `blast_radius` has to clear, which is a different number per option.
 *
 * `RADIUS_POLICY` holds the argument for why; the meter just shows which of its
 * rows this answer landed in.
 */
function radiusGate(name: string, answers: Record<string, JevAnswer>) {
  if (name !== "blast_radius") return undefined
  const radius = answers.blast_radius
  if (radius?.type !== "choice") return undefined
  const policy = RADIUS_POLICY[radius.choice]
  return policy && "allowAt" in policy ? policy.allowAt : undefined
}

export default function GuardrailDemo() {
  const run = useSingleRun(manifest)

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      policy={rule}
      answers={{ title: "Six properties, one request", thresholdFor: radiusGate }}
    >
      {({ input, answers, verdict }) => (
        <>
          <CommandCard command={input.command} />
          {verdict ? <VerdictCard ruling={verdict} /> : null}
          <GateTable selected={answers?.blast_radius} />
        </>
      )}
    </DemoScaffold>
  )
}
