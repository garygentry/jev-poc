import { DemoScaffold, useRounds } from "@/demos/_kit"

import { manifest } from "./demo"
import { best } from "./beam"
import { Outcome, Settings, TicketCard, Tree } from "./view"

export default function TaxonomyDemo() {
  const run = useRounds(manifest)
  const { rounds } = run
  const winner = rounds ? best(rounds[rounds.length - 1] ?? []) : null

  return (
    <DemoScaffold manifest={manifest} run={run} runLabel="Descend the tree">
      {({ input }) => (
        <>
          <TicketCard text={input.text} expected={input.expected} />
          <Settings />

          {rounds ? (
            <>
              <Outcome
                rounds={rounds}
                winner={winner}
                requests={run.requests}
                usage={run.usage}
                wallClockMs={run.latencyMs}
                source={run.source}
              />
              <Tree rounds={rounds} winner={winner} />
            </>
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
