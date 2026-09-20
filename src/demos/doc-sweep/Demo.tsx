import { useMemo } from "react"

import { DemoScaffold, useWindowed } from "@/demos/_kit"

import { manifest } from "./demo"
import { chunksOf } from "./document"
import { sweep as runSweep } from "./policy"
import { ChunkSweep, TopicCard, Verdict } from "./view"

const wireNote = (chunks: number) =>
  `${chunks} separate requests — one per overlapping chunk. Shown: the first.`

export default function DocSweepDemo() {
  const run = useWindowed(manifest, { wireNote })
  const { input: doc, results } = run

  // Join each chunk to its answer and aggregate the sweep, in document order.
  const sweep = useMemo(() => {
    if (!results) return null
    const byId = new Map(results.map((row) => [row.id, row]))
    const probs = new Map(
      chunksOf(doc).map((chunk) => {
        const answer = byId.get(chunk.id)?.answers?.discloses
        return [chunk.id, answer?.type === "noul" ? answer.noul : null] as const
      }),
    )
    return runSweep(chunksOf(doc), probs)
  }, [doc, results])

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Sweep ${chunksOf(doc).length} chunks`}
    >
      {() => (
        <>
          <TopicCard doc={doc} />
          {sweep ? (
            <>
              <Verdict
                sweep={sweep}
                doc={doc}
                usage={run.usage}
                wallClockMs={run.latencyMs}
                calls={run.calls}
                source={run.source}
              />
              <ChunkSweep sweep={sweep} loading={run.loading} />
            </>
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
