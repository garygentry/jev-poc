import { DemoScaffold, useSingleRun } from "@/demos/_kit"

import { manifest } from "./demo"
import { TRUSTED_CONFIDENCE, chooseModel } from "./policy"
import { Ladder, RequestCard, Verdict } from "./view"

export default function RouterDemo() {
  const run = useSingleRun(manifest)

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      policy={chooseModel}
      answers={{
        title: "What the router asked",
        thresholdFor: (name) =>
          name === "required_capability" ? TRUSTED_CONFIDENCE : undefined,
      }}
    >
      {({ input, verdict, run: envelope }) => (
        <>
          <RequestCard text={input.text} />
          {verdict ? (
            <>
              <Verdict
                route={verdict}
                // Only a live response carries a token count this app measured;
                // a fixture's is written down, not observed.
                usage={envelope.source === "live" ? envelope.usage : undefined}
              />
              <Ladder route={verdict} />
            </>
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
