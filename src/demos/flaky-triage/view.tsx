import { Check, Loader2, Play, RefreshCw, ServerCog, ShieldAlert, UserRound, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ErrorNote } from "@/components/layout/RunBar"
import type { BaselineController } from "@/demos/_kit"
import { ms, usd } from "@/lib/format"

import { CHAT_PRICES, type BaselineAnswer } from "@shared/baseline.ts"
import type { JevAnswer, JevQuestionSet, JevUsage } from "@shared/jev.ts"

import { ACTION_LABEL, type Action, type Triage } from "./policy"
import type { Failure } from "./failures"

const BASELINE = CHAT_PRICES["anthropic/claude-haiku-4.5"]

/** The failing test and its output, as CI printed it. */
export function FailureCard({ failure }: { failure: Failure }) {
  return (
    <Card>
      <div className="space-y-2 p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">Failing test</p>
        <p className="font-mono text-xs text-ink">{failure.test}</p>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md border border-[var(--hairline)] bg-[var(--mark)]/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-secondary">
          {failure.output}
        </pre>
      </div>
    </Card>
  )
}

const ACTION_ICON: Record<Action, typeof Check> = {
  retry: RefreshCw,
  block: ShieldAlert,
  infra: ServerCog,
  human: UserRound,
}
const ACTION_BADGE: Record<Action, "mark" | "warning" | "outline"> = {
  retry: "mark",
  block: "warning",
  infra: "outline",
  human: "outline",
}

/** What CI should do, and why — the one call the gate exists to make. */
export function ActionVerdict({ triage }: { triage: Triage }) {
  const Icon = ACTION_ICON[triage.action]
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <Badge variant={ACTION_BADGE[triage.action]}>{ACTION_LABEL[triage.action]}</Badge>
        <span className="min-w-0 text-xs text-ink-secondary">{triage.reason}</span>
      </div>
    </Card>
  )
}

/**
 * The same classification, measured against a chat model.
 *
 * Live-only: a replayed gate spent nothing, so pricing a real chat bill beside
 * it would misrepresent a recording as this run.
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
          The same classification, measured against a chat model
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Run the identical questions through {BASELINE?.label} and compare — cost,
          and where the reads land together.
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
              {loading ? "Classifying…" : `Run on ${BASELINE?.label}`}
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
        <Cell label="Jev gate" cost={gateCost} latencyMs={gateLatencyMs} />
        <Cell label={BASELINE?.label ?? "chat model"} cost={baselineCost} latencyMs={baselineLatencyMs} />
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
            and Jev returns the category confidence the retry gate reads — the chat model returns only the label
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

/** Do a Jev answer and a chat-model answer point the same way? Loose, never a score. */
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
