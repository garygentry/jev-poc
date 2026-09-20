import { ArrowDown, ArrowUp, Minus, Target } from "lucide-react"

import { UsageReadout } from "@/components/jev/Readouts"
import { Card } from "@/components/ui/card"
import { ms } from "@/lib/format"
import { cn } from "@/lib/utils"

import { PASSAGES } from "./corpus"
import { boundsOf, type Ranked } from "./baseline"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

/** What the customer asked, and which passage was fixed as the answer. */
export function QueryCard({ text, gold }: { text: string; gold: string }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          Customer asked
        </p>
        <p className="mt-1 text-sm text-ink">“{text}”</p>
        <p className="mt-2 text-[11px] text-ink-muted">
          The passage that answers it is{" "}
          <span className="font-mono text-ink">{gold}</span>, fixed before either
          ranker was run.
        </p>
      </div>
    </Card>
  )
}

/**
 * The measured comparison — shown only when the model actually answered.
 *
 * A scoreboard computed from replayed or synthetic values would be a fabricated
 * result, and this demo's entire claim is a measured one. The mechanism above
 * still demonstrates itself offline; the number does not.
 */
export function Scoreboard({
  gold,
  baseline,
  ranked,
  usage,
  wallClockMs,
  source,
}: {
  gold: string
  baseline: Ranked[]
  ranked: Ranked[]
  usage: JevUsage
  wallClockMs: number
  source: AnswerSource
}) {
  if (source !== "live") {
    return (
      <Card className="border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <Target
            className="mt-0.5 size-4 shrink-0 text-[var(--status-warning-ink)]"
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-ink-secondary">
            <span className="font-medium text-ink">
              No accuracy figure without a key.
            </span>{" "}
            The fan-out, the per-passage probabilities and the sort all work
            from replayed data — but a hit rate computed from answers the model
            did not give would be a fabricated result, so it is withheld rather
            than estimated.
          </p>
        </div>
      </Card>
    )
  }

  const before = boundsOf(baseline, gold)
  const after = boundsOf(ranked, gold)

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4 sm:p-5">
        <Stat
          label="Gold rank, keyword"
          value={before ? rangeLabel(before) : "—"}
        />
        <Stat label="Gold rank, re-ranked" value={after ? rangeLabel(after) : "—"} />
        <Stat label="Wall clock" value={ms(wallClockMs)} />
        <div className="ml-auto">
          <UsageReadout usage={usage} calls={ranked.length} />
        </div>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-2.5 sm:px-5">
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Both sides report a <strong>range</strong>, not a position. Where a
          scorer ties, it expressed no opinion and the sort supplied the order —
          calling that a rank would turn “no signal” into “wrong answer”.
        </p>
      </div>
    </Card>
  )
}

const rangeLabel = ([low, high]: [number, number]) =>
  low === high ? `#${low}` : `#${low}–${high}`

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  )
}

export function Column({
  title,
  subtitle,
  ranked,
  gold,
  format,
  compareTo,
  loading,
}: {
  title: string
  subtitle: string
  ranked: Ranked[] | null
  gold: string
  format: (score: number) => string
  compareTo?: Ranked[]
  loading?: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-4 py-3">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{subtitle}</p>
      </div>

      {!ranked ? (
        <p className="p-6 text-center text-sm text-ink-muted">
          {loading ? "Fanning out…" : "Not run yet."}
        </p>
      ) : (
        <ol className="max-h-[520px] divide-y divide-[var(--hairline)] overflow-auto">
          {ranked.slice(0, 12).map((row) => {
            const passage = PASSAGES.find((item) => item.id === row.id)!
            const isGold = row.id === gold
            const moved = compareTo ? movement(compareTo, ranked, row.id) : null

            return (
              <li
                key={row.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-2",
                  isGold && "bg-[var(--mark)]/10",
                )}
              >
                <span className="tabular w-12 shrink-0 font-mono text-[11px] text-ink-muted">
                  {rangeLabel(row.bounds)}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs",
                      isGold ? "font-medium text-ink" : "text-ink-secondary",
                    )}
                  >
                    {passage.title}
                  </p>
                  <p className="font-mono text-[10px] text-ink-muted">{row.id}</p>
                </div>
                {moved ? <Movement delta={moved} /> : null}
                <span className="tabular shrink-0 text-[11px] text-ink-muted">
                  {format(row.score)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

/** Change in the *midpoint* of the bounds, since a tie has no single position. */
function movement(before: Ranked[], after: Ranked[], id: string): number | null {
  const a = boundsOf(before, id)
  const b = boundsOf(after, id)
  if (!a || !b) return null
  const mid = (bounds: [number, number]) => (bounds[0] + bounds[1]) / 2
  return mid(a) - mid(b)
}

/**
 * Movement between the two rankings.
 *
 * Deliberately not colored green/red: a passage moving down is not "bad" — most
 * of them *should* move down — and status colors are reserved for actual
 * good/critical states. The arrow alone carries the direction.
 */
function Movement({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.5) {
    return <Minus className="size-3 shrink-0 text-ink-muted" aria-label="unchanged" />
  }
  const up = delta > 0
  return (
    <span
      className="tabular inline-flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted"
      aria-label={`moved ${up ? "up" : "down"} ${Math.abs(delta).toFixed(1)} places`}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(delta).toFixed(1)}
    </span>
  )
}

export function Caveats() {
  return (
    <Card>
      <div className="space-y-2 p-4 text-[11px] leading-relaxed text-ink-muted sm:p-5">
        <p className="font-medium text-ink-secondary">
          What this is and is not
        </p>
        <p>
          <strong className="text-ink-secondary">The baseline is crude and
          biased in its own favour.</strong>{" "}
          It does no length normalisation, so longer passages match more words.
          That makes the comparison conservative rather than rigged, but it is
          not neutral.
        </p>
        <p>
          <strong className="text-ink-secondary">Six queries is a
          demonstration, not a benchmark.</strong>{" "}
          The passages were written first as documentation; the queries were
          written afterwards but before either ranker ran, in a customer's words
          rather than the documentation's. Neither set was edited after seeing a
          result.
        </p>
        <p>
          <strong className="text-ink-secondary">Ties are reported as
          ranges on both sides.</strong>{" "}
          Giving the baseline a range and the re-ranker a point estimate would
          flatter the re-ranker by precisely the mechanism the range exists to
          correct.
        </p>
      </div>
    </Card>
  )
}
