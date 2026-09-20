import { useMemo } from "react"

import { DemoScaffold, useFanOut } from "@/demos/_kit"
import { percent } from "@/lib/format"

import { manifest } from "./demo"
import { PASSAGES } from "./corpus"
import { keywordScore, rankWithBounds } from "./baseline"
import { Caveats, Column, QueryCard, Scoreboard } from "./view"

const wireNote = (items: number) =>
  `${items} separate requests — one per candidate. Shown: the first.`

export default function RerankDemo() {
  const run = useFanOut(manifest, { wireNote })
  const { input: query, results } = run

  /** The same corpus scored by word overlap, computed offline for comparison. */
  const baseline = useMemo(
    () =>
      rankWithBounds(
        PASSAGES.map((passage) => ({
          id: passage.id,
          score: keywordScore(query.text, passage),
        })),
      ),
    [query],
  )

  const ranked = useMemo(
    () =>
      results
        ? rankWithBounds(
            results.map((row) => {
              const answer = row.answers?.relevant
              return {
                id: row.id,
                score: answer?.type === "noul" ? answer.noul : 0,
              }
            }),
          )
        : null,
    [results],
  )

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Re-rank ${PASSAGES.length} passages`}
      footer={<Caveats />}
    >
      {() => (
        <>
          <QueryCard text={query.text} gold={query.gold} />

          {ranked && run.usage && run.latencyMs !== undefined && run.source ? (
            <Scoreboard
              gold={query.gold}
              baseline={baseline}
              ranked={ranked}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              source={run.source}
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Column
              title="Keyword baseline"
              subtitle="Content-word overlap. No length normalisation, so it favours longer passages."
              ranked={baseline}
              gold={query.gold}
              format={(score) => `${score} word${score === 1 ? "" : "s"}`}
            />
            <Column
              title="Jev re-rank"
              subtitle="One noul per passage, sorted by probability."
              ranked={ranked}
              gold={query.gold}
              format={(score) => percent(score, 1)}
              compareTo={baseline}
              loading={run.loading}
            />
          </div>
        </>
      )}
    </DemoScaffold>
  )
}
