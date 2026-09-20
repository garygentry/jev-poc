import { useMemo } from "react"

import { DemoScaffold, useFanOut } from "@/demos/_kit"

import { manifest } from "./demo"
import { classify, type Classified } from "./policy"
import { Results, RuleCard } from "./view"

const wireNote = (items: number) =>
  `${items} separate requests — one per function. Shown: the first.`

export default function SemanticGrepDemo() {
  const run = useFanOut(manifest, { wireNote })
  const { input: search, results } = run

  // Join each function's match probability back to it, then classify it against
  // the regex baseline. A function with no row yet carries a null probability.
  const classified = useMemo<Classified[]>(() => {
    const byId = new Map((results ?? []).map((row) => [row.id, row]))
    return search.functions.map((fn) => {
      const answer = byId.get(fn.id)?.answers?.matches
      return classify(fn, answer?.type === "noul" ? answer.noul : null)
    })
  }, [search, results])

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Search ${search.functions.length} functions`}
    >
      {() => (
        <>
          <RuleCard />
          {results || run.loading ? (
            <Results
              classified={classified}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              calls={run.calls}
              source={run.source}
              loading={run.loading}
            />
          ) : null}
        </>
      )}
    </DemoScaffold>
  )
}
