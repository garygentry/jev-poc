import { Check, Eye, GitPullRequest, Loader2, Play, ShieldAlert, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ErrorNote } from "@/components/layout/RunBar"
import type { BaselineController } from "@/demos/_kit"
import { ms, usd } from "@/lib/format"

import { CHAT_PRICES, type BaselineAnswer } from "@shared/baseline.ts"
import type { JevAnswer, JevQuestionSet, JevUsage } from "@shared/jev.ts"

import { LEVEL_LABEL, type Level, type Triage } from "./policy"
import type { PullRequest } from "./prs"

const BASELINE = CHAT_PRICES["anthropic/claude-haiku-4.5"]

/** The pull request as a reviewer first meets it. */
export function PrCard({ pr }: { pr: PullRequest }) {
  return (
    <Card>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-2">
          <GitPullRequest className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{pr.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-secondary">
              {pr.description}
            </p>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-md border border-[var(--hairline)] bg-[var(--mark)]/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-secondary">
          {pr.diff}
        </pre>
      </div>
    </Card>
  )
}

const LEVEL_BADGE: Record<Level, "mark" | "outline" | "warning"> = {
  auto: "mark",
  glance: "outline",
  review: "warning",
}

/** The one question a review queue needs answered: does a human have to see this? */
export function ReviewVerdict({ triage }: { triage: Triage }) {
  const { level, human, reasons } = triage
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--hairline)] px-3.5 py-3">
        {level === "review" ? (
          <ShieldAlert className="size-4 shrink-0 text-[var(--status-warning-ink)]" aria-hidden />
        ) : level === "glance" ? (
          <Eye className="size-4 shrink-0 text-ink-muted" aria-hidden />
        ) : (
          <Check className="size-4 shrink-0 text-[var(--mark)]" aria-hidden />
        )}
        <Badge variant={LEVEL_BADGE[level]}>{LEVEL_LABEL[level]}</Badge>
        <span className="text-[11px] text-ink-muted">
          {human ? "a human looks before it merges" : "no human needed"}
        </span>
      </div>
      <ul className="divide-y divide-[var(--hairline)]">
        {reasons.map((reason) => (
          <li key={reason} className="px-3.5 py-2 text-xs text-ink-secondary">
            {reason}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/**
 * The same risk read, measured against a chat model.
 *
 * Jev already answered as the gate; this runs the identical questions through
 * Haiku 4.5 and lays cost and reads side by side. Live-only: a replayed gate
 * spent no money, so pricing a real chat bill beside it would be a lie.
 */
export function MeasuredComparison({
  baseline,
  questions,
  jevAnswers,
  gateUsage,
  gateLatencyMs,
  live,
}: {
  baseline: BaselineController
  questions: JevQuestionSet
  jevAnswers: Record<string, JevAnswer> | null
  gateUsage?: JevUsage
  gateLatencyMs?: number
  live: boolean
}) {
  if (!live) return null
  const { result, loading, error, run } = baseline

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">
          The same risk read, measured against a chat model
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Run the identical five questions through {BASELINE?.label} and compare —
          cost, and where the reads land together.
        </p>
      </div>

      {!result ? (
        <div className="space-y-3 px-3.5 py-3">
          <Badge variant="warning" className="gap-1.5">
            Spends real money on {BASELINE?.label}
          </Badge>
          <div>
            <Button size="sm" onClick={run} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {loading ? "Running the read…" : `Run on ${BASELINE?.label}`}
            </Button>
          </div>
          {error ? <ErrorNote message={error} /> : null}
        </div>
      ) : (
        <Settled
          questions={questions}
          jevAnswers={jevAnswers}
          baselineAnswers={result.answers}
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
  questions,
  jevAnswers,
  baselineAnswers,
  baselineCost,
  baselineLatencyMs,
  gateCost,
  gateLatencyMs,
}: {
  questions: JevQuestionSet
  jevAnswers: Record<string, JevAnswer> | null
  baselineAnswers: Record<string, BaselineAnswer>
  baselineCost: number
  baselineLatencyMs: number
  gateCost: number
  gateLatencyMs?: number
}) {
  const ratio = gateCost > 0 ? baselineCost / gateCost : null

  return (
    <>
      <dl className="grid grid-cols-2 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)]">
        <Cell label="Jev gate · 5 reads" cost={gateCost} latencyMs={gateLatencyMs} />
        <Cell label={`${BASELINE?.label} · same 5`} cost={baselineCost} latencyMs={baselineLatencyMs} />
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
            and Jev returns a calibrated confidence per read — the chat model returns only the value
          </span>
        </dd>
      </div>

      <div className="divide-y divide-[var(--hairline)]">
        {Object.keys(questions).map((name) => {
          const a = jevAnswers?.[name]
          const b = baselineAnswers[name]
          const agree = a && b ? sameLeaning(a, b) : false
          return (
            <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 px-3.5 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs text-ink">{name}</div>
                <div className="tabular mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-ink-muted">
                  <span>Jev {a ? show(a) : "—"}</span>
                  <span>{BASELINE?.label} {b ? show(b) : "—"}</span>
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

      <p className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
        No read is scored as correct — there is no ground truth here. The table
        shows where the two point the same way, as data.
      </p>
    </>
  )
}

function Cell({ label, cost, latencyMs }: { label: string; cost: number; latencyMs?: number }) {
  return (
    <div className="px-3.5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs">
        <span className="tabular text-ink">{usd(cost)}</span>
        {latencyMs !== undefined ? <span className="tabular text-ink-muted">{ms(latencyMs)}</span> : null}
      </dd>
    </div>
  )
}

/** Do a Jev answer and a chat-model answer point the same way? A loose test, never a score. */
function sameLeaning(a: JevAnswer, b: BaselineAnswer): boolean {
  if (a.type === "choice" && b.type === "choice") return a.choice === b.choice
  if (a.type === "score" && b.type === "score") return Math.round(a.score) === Math.round(b.score)
  if (a.type === "noul" && b.type === "noul") return a.noul >= 0.5 === b.noul >= 0.5
  return false
}

function show(answer: JevAnswer | BaselineAnswer): string {
  if (answer.type === "choice") return answer.choice
  if (answer.type === "score") return answer.score.toFixed(1)
  return answer.noul.toFixed(2)
}
