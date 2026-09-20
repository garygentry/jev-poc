import { useMemo } from "react"

import { DemoScaffold, usePairwise } from "@/demos/_kit"

import { manifest } from "./demo"
import { cluster, templateGroups, type Edge } from "./policy"
import { AlertList, Comparison, ComparingNote } from "./view"

const wireNote = (pairs: number) =>
  `${pairs} separate requests — one per pair of alerts. Shown: the first.`

export default function AlertDedupDemo() {
  const run = usePairwise(manifest, { wireNote })
  const { input: storm, results } = run

  // Turn the pairwise answers into edges, cluster them into incidents, and read
  // the template rule's grouping off the same alerts for the side-by-side.
  const { incidents, templates } = useMemo(() => {
    const templates = templateGroups(storm.alerts)
    if (!results) return { incidents: null, templates }
    const byId = new Map(results.map((row) => [row.id, row]))
    const edges: Edge[] = storm.alerts.flatMap((a, i) =>
      storm.alerts.slice(i + 1).map((b) => {
        const answer = byId.get(`${a.id}--${b.id}`)?.answers?.same_incident
        return { a: a.id, b: b.id, noul: answer?.type === "noul" ? answer.noul : null }
      }),
    )
    const incidents = cluster(
      storm.alerts.map((a) => a.id),
      edges,
    )
    return { incidents, templates }
  }, [storm, results])

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Compare ${manifest.estimateCalls(storm)} pairs`}
    >
      {() => (
        <>
          {incidents ? (
            <Comparison
              storm={storm}
              incidents={incidents}
              templates={templates}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              calls={run.calls}
              source={run.source}
            />
          ) : run.loading ? (
            <ComparingNote />
          ) : (
            <AlertList alerts={storm.alerts} />
          )}
        </>
      )}
    </DemoScaffold>
  )
}
