import { useCallback, useMemo, useState } from "react"
import { Split, Users } from "lucide-react"

import { NoulGauge } from "@/components/jev/NoulGauge"
import { WirePanel } from "@/components/jev/WirePanel"
import { SourceBadge, UsageReadout } from "@/components/jev/Readouts"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote, RunBar } from "@/components/layout/RunBar"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { demoBySlug } from "@/demos/registry"
import { batch } from "@/lib/jev-client"
import { useSpend } from "@/lib/spend-context"
import { ms, percent } from "@/lib/format"
import { cn } from "@/lib/utils"

import { PERSONAS, stateFor } from "./personas"
import { DRAFTS } from "./examples"
import { QUESTIONS } from "./questions"
import { describeSpread, readPanel, type Reading } from "./spread"

import type { AnswerSource, JevUsage, JevWire } from "@shared/jev.ts"

const demo = demoBySlug("personas")!

interface Run {
  readings: Reading[]
  usage: JevUsage
  wallClockMs: number
  source: AnswerSource
  wire: JevWire
}

export default function PersonasDemo() {
  const [message, setMessage] = useState(DRAFTS[0]!.text)
  const [selected, setSelected] = useState<string | null>(DRAFTS[0]!.id)
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { refresh } = useSpend()

  const poll = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRun(null)

    const items = PERSONAS.map((persona) => ({
      id: persona.id,
      state: stateFor(persona, message),
    }))

    try {
      const response = await batch({
        items,
        questions: QUESTIONS,
        fixtureKey: selected ? `personas/${selected}` : undefined,
      })
      setRun({
        readings: readPanel(response.results),
        usage: response.usage,
        wallClockMs: response.wallClockMs,
        source: response.source,
        wire: {
          request: {
            note: `${items.length} requests — one per reader, because each reader is a different state.`,
            model: "typesafe/jev-1.13",
            state: items[0]!.state,
            questions: QUESTIONS,
          },
          response: response.results.slice(0, 2),
        },
      })
      void refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [message, selected, refresh])

  const spread = useMemo(
    () => (run ? describeSpread(run.readings) : null),
    [run],
  )

  return (
    <DemoFrame demo={demo}>
      <div className="flex flex-wrap gap-1.5">
        {DRAFTS.map((draft) => (
          <button
            key={draft.id}
            type="button"
            onClick={() => {
              setSelected(draft.id)
              setMessage(draft.text)
              setRun(null)
            }}
            aria-pressed={selected === draft.id}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              selected === draft.id
                ? "border-[var(--mark)] bg-[var(--mark)]/10 text-ink"
                : "border-[var(--hairline)] text-ink-secondary hover:text-ink",
            )}
          >
            {draft.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="space-y-3 p-4 sm:p-5">
          <label htmlFor="message" className="block text-xs font-medium text-ink">
            The message
          </label>
          <Textarea
            id="message"
            value={message}
            onChange={(event) => {
              setSelected(null)
              setMessage(event.target.value)
              setRun(null)
            }}
            rows={4}
            className="leading-relaxed"
          />
        </div>
      </Card>

      <RunBar
        onRun={() => void poll()}
        loading={loading}
        runLabel={`Poll ${PERSONAS.length} readers`}
        usage={run?.usage}
        calls={run ? PERSONAS.length : undefined}
        source={run?.source}
      />

      {error ? <ErrorNote message={error} /> : null}

      {run && spread ? (
        <Card>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4 sm:p-5">
            <Users className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <Figure label="Would act" value={`${spread.convinced} of ${run.readings.length}`} />
            <Figure label="Unmoved" value={String(spread.unmoved)} />
            <Figure label="On the fence" value={String(spread.undecided)} />
            <Figure label="Range" value={`${percent(spread.min, 0)}–${percent(spread.max, 0)}`} />
            <Figure label="Mean" value={percent(spread.mean, 0)} note="least useful number here" />
            <Figure label="Spread (σ)" value={spread.deviation.toFixed(2)} />
            {run.source === "live" ? (
              <div className="ml-auto flex items-center gap-4">
                <span className="tabular text-xs text-ink-secondary">
                  {ms(run.wallClockMs)}
                </span>
                <UsageReadout usage={run.usage} calls={run.readings.length} />
              </div>
            ) : (
              <div className="ml-auto">
                <SourceBadge source={run.source} />
              </div>
            )}
          </div>

          <div className="border-t border-[var(--hairline)] px-4 py-2.5 sm:px-5">
            {spread.polarised ? (
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-secondary">
                <Split
                  className="mt-0.5 size-3.5 shrink-0 text-[var(--mark)]"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-ink">The panel splits.</span>{" "}
                  Mass at both ends rather than piled in the middle — this
                  message works for one part of the audience and not another,
                  which is a different problem from a message nobody likes. The
                  mean of {percent(spread.mean, 0)} describes neither group.
                </span>
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-ink-secondary">
                <span className="font-medium text-ink">No real split.</span> The
                panel broadly agrees, so the mean of {percent(spread.mean, 0)} is
                actually representative here — which is not something you could
                know without looking at the spread.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      {run ? <Panel readings={run.readings} /> : null}
      {run ? <WirePanel wire={run.wire} /> : null}

      <Card>
        <p className="p-4 text-[11px] leading-relaxed text-ink-muted sm:p-5">
          <span className="font-medium text-ink-secondary">
            Twelve invented readers are not a market.
          </span>{" "}
          This panel shows where a message divides an audience{" "}
          <em>along the dimensions written into these personas</em> — nothing
          more. It is a way of reading a distribution rather than an argmax, and
          a shape that fans out because each reader is a different state. It is
          not a substitute for asking real people.
        </p>
      </Card>
    </DemoFrame>
  )
}

function Panel({ readings }: { readings: Reading[] }) {
  const sorted = [...readings].sort((a, b) => b.wouldAct - a.wouldAct)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((reading) => {
        const persona = PERSONAS.find((item) => item.id === reading.id)
        if (!persona) return null

        return (
          <Card key={reading.id}>
            <div className="space-y-2.5 p-3.5">
              <div>
                <h4 className="text-xs font-medium text-ink">{persona.name}</h4>
                <p className="text-[10px] text-ink-muted">
                  {persona.industry} · {persona.seniority}
                </p>
              </div>

              <NoulGauge label="Would act" value={reading.wouldAct} />

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-ink-muted">Lands</span>
                  <span className="tabular text-[10px] text-ink-secondary">
                    {reading.lands === null
                      ? "cannot tell"
                      : `${reading.lands.toFixed(2)} / 3`}
                  </span>
                </div>
                <div className="mt-1 h-1 w-full rounded-full bg-[var(--gridline)]">
                  {reading.lands === null ? null : (
                    <div
                      className="h-full rounded-full bg-[var(--mark)]"
                      style={{ width: `${(reading.lands / 3) * 100}%` }}
                    />
                  )}
                </div>
              </div>

              <p className="text-[10px] leading-snug text-ink-muted">
                {persona.disposition}
              </p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function Figure({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium text-ink">{value}</p>
      {note ? <p className="text-[10px] text-ink-muted">{note}</p> : null}
    </div>
  )
}
