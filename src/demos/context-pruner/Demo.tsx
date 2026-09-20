import { useMemo } from "react"

import { DemoScaffold, useFanOut } from "@/demos/_kit"

import { manifest } from "./demo"
import { tokensOf } from "./context"
import { prune, type Judged } from "./policy"
import { ChunkList, GoalCard, Savings } from "./view"

const wireNote = (items: number) =>
  `${items} separate requests — one per chunk. Shown: the first.`

export default function ContextPrunerDemo() {
  const run = useFanOut(manifest, { wireNote })
  const { input: scenario, results } = run

  // Join each chunk's size with the relevance the gate returned for it. A chunk
  // the fan-out has no row for yet carries a null relevance, which `prune`
  // treats as "keep" — the same safe default the policy documents.
  const judged = useMemo<Judged[]>(() => {
    const byId = new Map(
      (results ?? []).map((row) => {
        const answer = row.answers?.relevant
        return [row.id, answer?.type === "noul" ? answer.noul : null] as const
      }),
    )
    return scenario.chunks.map((chunk) => ({
      id: chunk.id,
      tokens: tokensOf(chunk.text),
      relevance: results ? (byId.get(chunk.id) ?? null) : null,
    }))
  }, [scenario, results])

  const pruned = useMemo(() => prune(judged), [judged])
  const judgedById = useMemo(
    () => (results ? new Map(judged.map((chunk) => [chunk.id, chunk])) : null),
    [judged, results],
  )

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Prune ${scenario.chunks.length} chunks`}
    >
      {() => (
        <>
          <GoalCard goal={scenario.goal} />

          {results ? (
            <Savings
              pruned={pruned}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              calls={run.calls}
              source={run.source}
            />
          ) : null}

          <ChunkList scenario={scenario} judged={judgedById} loading={run.loading} />
        </>
      )}
    </DemoScaffold>
  )
}
