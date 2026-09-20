import { useMemo } from "react"

import { DemoScaffold, useFanOut } from "@/demos/_kit"

import { manifest } from "./demo"
import { assess } from "./policy"
import { RiskMatrix, Summary, type Row } from "./view"

const wireNote = (items: number) =>
  `${items} separate requests — one per clause. Shown: the first.`

export default function ClauseRiskDemo() {
  const run = useFanOut(manifest, { wireNote })
  const { input: contract, results } = run

  // Join each clause to its four risk reads, in contract order.
  const rows = useMemo<Row[]>(() => {
    const byId = new Map((results ?? []).map((row) => [row.id, row]))
    return contract.clauses.map((clause) => ({
      clause,
      assessment: assess(byId.get(clause.id)?.answers),
    }))
  }, [contract, results])

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Read ${contract.clauses.length} clauses`}
    >
      {() => (
        <>
          {results ? (
            <Summary
              rows={rows}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              calls={run.calls}
              source={run.source}
            />
          ) : null}
          {results || run.loading ? (
            <RiskMatrix rows={rows} loading={run.loading} />
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
