import { Check, ClipboardCheck, Loader2, Play, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ErrorNote } from "@/components/layout/RunBar"
import type { BaselineController } from "@/demos/_kit"
import { ms, usd } from "@/lib/format"

import { CHAT_PRICES, type BaselineAnswer } from "@shared/baseline.ts"
import type { JevUsage } from "@shared/jev.ts"

import type { Task } from "./evidence"
import { MET_THRESHOLD, type DoneCheck } from "./policy"

const BASELINE = CHAT_PRICES["anthropic/claude-haiku-4.5"]

/** The task, and the agent's own "done" — the claim the check audits. */
export function TaskCard({ task }: { task: Task }) {
  return (
    <Card>
      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">The task</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{task.task}</p>
        </div>
        <div className="rounded-md border border-[var(--hairline)] bg-[var(--mark)]/5 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            The agent reported
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">“{task.report}”</p>
        </div>
      </div>
    </Card>
  )
}

/**
 * The verdict, then the criteria as a matrix against the one piece of evidence.
 *
 * The headline is the whole product: an agent's "done" turned into a checked
 * done, with the criteria that block it named rather than a bare no. Each row is
 * a noul gauge with the gate drawn on it, so *why* a criterion blocked — clearly
 * against, or merely unconfirmed — is legible at a glance and never a checkbox.
 */
export function DoneMatrix({ check }: { check: DoneCheck }) {
  const { done, criteria, blockers } = check
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--hairline)] px-3.5 py-3">
        <ClipboardCheck className="size-4 shrink-0 text-ink-muted" aria-hidden />
        {done ? (
          <Badge variant="mark" className="gap-1">
            <Check aria-hidden />
            done — every criterion met
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <X aria-hidden />
            not done — {blockers.length} of {criteria.length} blocking
          </Badge>
        )}
        {!done ? (
          <span className="text-[11px] text-ink-muted">
            blocked on {blockers.map((b) => b.label).join(", ")}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-[var(--hairline)]">
        {criteria.map((c) => (
          <li key={c.name} className="px-3.5 py-3">
            <div className="mb-1.5 flex items-center gap-2">
              {c.met ? (
                <Check className="size-3.5 text-[var(--mark)]" aria-hidden />
              ) : (
                <X className="size-3.5 text-[var(--status-warning-ink)]" aria-hidden />
              )}
              <span className="text-xs font-medium text-ink">{c.label}</span>
            </div>
            {c.probability === null ? (
              <p className="text-[11px] text-ink-muted">
                unanswered — counted as not met
              </p>
            ) : (
              <NoulGauge
                label="met, per the evidence"
                value={c.probability}
                threshold={MET_THRESHOLD}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/**
 * The same five checks, measured against a chat model.
 *
 * Jev already answered as the gate; this runs the *identical* question set
 * through Haiku 4.5 and lays the two side by side — cost, and where they land
 * together. It only renders against a live gate, because a replayed gate spent
 * no money and pricing a real chat bill beside a recording would be a lie. The
 * run itself is behind a button: it spends real money on a second model.
 */
export function MeasuredComparison({
  baseline,
  check,
  gateUsage,
  gateLatencyMs,
  live,
}: {
  baseline: BaselineController
  check: DoneCheck
  gateUsage?: JevUsage
  gateLatencyMs?: number
  /** The gate answers came from the live model; only then is any bill real. */
  live: boolean
}) {
  if (!live) return null
  const { result, loading, error, run } = baseline

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">
          The same check, measured against a chat model
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Run the identical five criteria through {BASELINE?.label} and compare —
          every figure from usage. A reviewer doing this by hand is the other
          alternative; that cost is stated on the run bar, not measured here.
        </p>
      </div>

      {!result ? (
        <div className="space-y-3 px-3.5 py-3">
          <Badge variant="warning" className="gap-1.5">
            Spends real money on {BASELINE?.label}
          </Badge>
          <div>
            <Button size="sm" onClick={run} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
              {loading ? "Running the check…" : `Run on ${BASELINE?.label}`}
            </Button>
          </div>
          {error ? <ErrorNote message={error} /> : null}
        </div>
      ) : (
        <Settled
          check={check}
          jevAnswers={result.answers}
          baselineCost={result.usage.cost}
          baselineLatencyMs={result.latencyMs}
          gateCost={gateUsage?.cost ?? 0}
          gateLatencyMs={gateLatencyMs}
        />
      )}
    </Card>
  )
}

function Settled({
  check,
  jevAnswers,
  baselineCost,
  baselineLatencyMs,
  gateCost,
  gateLatencyMs,
}: {
  check: DoneCheck
  jevAnswers: Record<string, BaselineAnswer>
  baselineCost: number
  baselineLatencyMs: number
  gateCost: number
  gateLatencyMs?: number
}) {
  const ratio = gateCost > 0 ? baselineCost / gateCost : null

  return (
    <>
      <dl className="grid grid-cols-2 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)]">
        <Cell label="Jev gate · 5 criteria" cost={gateCost} latencyMs={gateLatencyMs} />
        <Cell
          label={`${BASELINE?.label} · same 5`}
          cost={baselineCost}
          latencyMs={baselineLatencyMs}
        />
      </dl>

      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Result</dt>
        <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {ratio !== null && ratio > 1 ? (
            <span className="tabular text-sm font-medium text-[var(--mark)]">
              {ratio.toFixed(ratio >= 10 ? 0 : 1)}× cheaper than the chat model
            </span>
          ) : (
            <span className="text-sm text-ink-muted">no measured saving</span>
          )}
          <span className="text-[11px] text-ink-muted">
            and it comes back typed, with a probability per criterion — no parsing
          </span>
        </dd>
      </div>

      <Agreement check={check} jevAnswers={jevAnswers} />

      <p className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
        There is no ground truth here; the table shows where the two agreed, as
        data. The chat model was given the identical criteria, so this is a real
        head-to-head, not a controlled experiment.
      </p>
    </>
  )
}

/** One measured column: what a path cost and how long it took. */
function Cell({
  label,
  cost,
  latencyMs,
}: {
  label: string
  cost: number
  latencyMs?: number
}) {
  return (
    <div className="px-3.5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs">
        <span className="tabular text-ink">{usd(cost)}</span>
        {latencyMs !== undefined ? (
          <span className="tabular text-ink-muted">{ms(latencyMs)}</span>
        ) : null}
      </dd>
    </div>
  )
}

/** Per criterion: did Jev and the chat model land on the same side of the gate? */
function Agreement({
  check,
  jevAnswers,
}: {
  check: DoneCheck
  jevAnswers: Record<string, BaselineAnswer>
}) {
  return (
    <div className="divide-y divide-[var(--hairline)]">
      {check.criteria.map((c) => {
        const other = jevAnswers[c.name]
        const otherMet = other?.type === "noul" ? other.noul >= MET_THRESHOLD : null
        const agree = otherMet !== null && otherMet === c.met
        return (
          <div
            key={c.name}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 px-3.5 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-xs text-ink">{c.label}</div>
              <div className="tabular mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-ink-muted">
                <span>Jev {c.probability !== null ? c.probability.toFixed(2) : "—"}</span>
                <span>
                  {BASELINE?.label}{" "}
                  {other?.type === "noul" ? other.noul.toFixed(2) : "—"}
                </span>
              </div>
            </div>
            {agree ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                <Check className="size-3.5" aria-hidden />
                agree
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--status-warning-ink)]">
                <X className="size-3.5" aria-hidden />
                differ
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
