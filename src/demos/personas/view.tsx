import { Split, Users } from "lucide-react"

import { NoulGauge } from "@/components/jev/NoulGauge"
import { SourceBadge, UsageReadout } from "@/components/jev/Readouts"
import { Card } from "@/components/ui/card"
import { ms, percent } from "@/lib/format"

import { PERSONAS } from "./personas"
import type { Reading, Spread } from "./spread"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

/**
 * The panel read as a distribution rather than as a mean.
 *
 * Where it splits is the whole point, so the split gets its own sentence under
 * the figures: a mean of 50% over a polarised panel describes nobody in it.
 */
export function SpreadCard({
  spread,
  readings,
  usage,
  wallClockMs,
  source,
}: {
  spread: Spread
  readings: Reading[]
  usage?: JevUsage
  wallClockMs?: number
  source?: AnswerSource
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4 sm:p-5">
        <Users className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <Figure label="Would act" value={`${spread.convinced} of ${readings.length}`} />
        <Figure label="Unmoved" value={String(spread.unmoved)} />
        <Figure label="On the fence" value={String(spread.undecided)} />
        <Figure label="Range" value={`${percent(spread.min, 0)}–${percent(spread.max, 0)}`} />
        <Figure label="Mean" value={percent(spread.mean, 0)} note="least useful number here" />
        <Figure label="Spread (σ)" value={spread.deviation.toFixed(2)} />
        {source === "live" && usage ? (
          <div className="ml-auto flex items-center gap-4">
            {wallClockMs !== undefined ? (
              <span className="tabular text-xs text-ink-secondary">
                {ms(wallClockMs)}
              </span>
            ) : null}
            <UsageReadout usage={usage} calls={readings.length} />
          </div>
        ) : source ? (
          <div className="ml-auto">
            <SourceBadge source={source} />
          </div>
        ) : null}
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
              Mass at both ends rather than piled in the middle — this message
              works for one part of the audience and not another, which is a
              different problem from a message nobody likes. The mean of{" "}
              {percent(spread.mean, 0)} describes neither group.
            </span>
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-ink-secondary">
            <span className="font-medium text-ink">No real split.</span> The
            panel broadly agrees, so the mean of {percent(spread.mean, 0)} is
            actually representative here — which is not something you could know
            without looking at the spread.
          </p>
        )}
      </div>
    </Card>
  )
}

/** One card per reader, sorted by how likely that reader is to act. */
export function Panel({ readings }: { readings: Reading[] }) {
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

export function Caveat() {
  return (
    <Card>
      <p className="p-4 text-[11px] leading-relaxed text-ink-muted sm:p-5">
        <span className="font-medium text-ink-secondary">
          Twelve invented readers are not a market.
        </span>{" "}
        This panel shows where a message divides an audience{" "}
        <em>along the dimensions written into these personas</em> — nothing
        more. It is a way of reading a distribution rather than an argmax, and a
        shape that fans out because each reader is a different state. It is not
        a substitute for asking real people.
      </p>
    </Card>
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
