import { useMemo } from "react"

import { DemoScaffold, useFanOut } from "@/demos/_kit"
import { Card } from "@/components/ui/card"
import { percent } from "@/lib/format"

import { CONCURRENCY, manifest } from "./demo"
import { buildDataset } from "./dataset"
import { countNoul, meanScore, reviewQueue, tally } from "./summarize"
import {
  Controls,
  Economics,
  Figure,
  Histogram,
  ReviewQueue,
  Sample,
} from "./view"

const wireNote = (items: number) =>
  `${items} requests, ${CONCURRENCY} at a time. Shown: the first.`

export default function BulkDemo() {
  const run = useFanOut(manifest, { concurrency: CONCURRENCY, wireNote })
  const { results } = run
  const rowCount = run.input.rows

  const rows = useMemo(() => buildDataset(rowCount), [rowCount])

  const sentiment = results ? tally(results, "sentiment") : null
  const theme = results ? tally(results, "theme") : null
  const severity = results ? meanScore(results, "severity") : null
  const actionable = results ? countNoul(results, "is_actionable") : null
  // Spans every Choice question, not just the first one charted.
  const queue = results ? reviewQueue(results, ["sentiment", "theme"]) : null

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      // The run bar cannot express a row count and a concurrency readout, and
      // this is the one demo where what you are about to spend is the control.
      showRunBar={false}
      before={
        <Controls
          choices={manifest.examples.map((example) => example.input.rows)}
          rowCount={rowCount}
          onRowCount={run.select}
          onStart={run.run}
          loading={run.loading}
          source={run.source}
        />
      }
      footer={<Sample rows={rows.slice(0, 4)} total={rows.length} />}
    >
      {() =>
        results ? (
          <>
            <Economics
              rowCount={rows.length}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              source={run.source}
            />

            <div className="grid gap-4 md:grid-cols-2">
              {sentiment ? (
                <Histogram
                  title="Sentiment"
                  subtitle={`${sentiment.labelled} of ${rows.length} rows confident enough to count`}
                  counts={sentiment.counts}
                  total={sentiment.labelled}
                />
              ) : null}
              {theme ? (
                <Histogram
                  title="Theme"
                  subtitle={`${theme.labelled} of ${rows.length} rows confident enough to count`}
                  counts={theme.counts}
                  total={theme.labelled}
                />
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <div className="space-y-3 p-4 sm:p-5">
                  <h3 className="text-sm font-medium text-ink">Other labels</h3>
                  {severity ? (
                    <Figure
                      label="Mean severity"
                      value={`${severity.mean.toFixed(2)} / 2`}
                      note={`over ${severity.counted} readable rows`}
                    />
                  ) : null}
                  {actionable ? (
                    <Figure
                      label="Actionable as written"
                      value={percent(
                        actionable.held / Math.max(1, actionable.counted),
                        0,
                      )}
                      note={`${actionable.held} of ${actionable.counted}`}
                    />
                  ) : null}
                </div>
              </Card>

              {queue ? <ReviewQueue queue={queue} total={rows.length} /> : null}
            </div>
          </>
        ) : null
      }
    </DemoScaffold>
  )
}
