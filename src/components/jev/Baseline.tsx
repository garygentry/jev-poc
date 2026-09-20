import { Check, Loader2, Minus, Play, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorNote } from "@/components/layout/RunBar"
import { cn } from "@/lib/utils"
import { ms, usd } from "@/lib/format"

import type { BaselineController } from "@/demos/_kit/runners/useBaseline"

import {
  CHAT_PRICES,
  compareAll,
  projectCost,
} from "@shared/baseline.ts"
import type { AnswerSource, JevAnswer, JevQuestionSet, JevUsage } from "@shared/jev.ts"

interface BaselineProps {
  controller: BaselineController
  questions: JevQuestionSet
  /** The live Jev answers to compare against. */
  jevAnswers: Record<string, JevAnswer> | null
  jevUsage?: JevUsage
  jevLatencyMs?: number
  /** Only rendered against a live Jev run; a replayed one has nothing to match. */
  source?: AnswerSource
  className?: string
}

/**
 * A measured second opinion from an ordinary chat model, beside Jev's.
 *
 * This is the harness the tour is built to justify: two models, both measured,
 * on the same input. It runs a *second*, dearer model, so it never fires on its
 * own — a badge names the cost and a button starts it. What it shows afterwards
 * is a disagreement, not a scoreboard: these fixtures have no ground truth, so
 * the two columns sit side by side and the reader judges.
 */
export function Baseline({
  controller,
  questions,
  jevAnswers,
  jevUsage,
  jevLatencyMs,
  source,
  className,
}: BaselineProps) {
  if (source !== "live") return null

  const { result, loading, error, run } = controller

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">Measured baseline</h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          The same questions, asked of an ordinary chat model. Both sides
          measured; agreement shown as data, never scored.
        </p>
      </div>

      {!result ? (
        <div className="space-y-3 px-3.5 py-3">
          <Badge variant="warning" className="gap-1.5">
            Spends real money on a second model
          </Badge>
          <div>
            <Button size="sm" onClick={run} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
              {loading ? "Asking Haiku 4.5…" : "Run Haiku 4.5 baseline"}
            </Button>
          </div>
          {error ? <ErrorNote message={error} /> : null}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)]">
            <MeasuredCell
              label="Jev"
              cost={jevUsage?.cost}
              latencyMs={jevLatencyMs}
            />
            <MeasuredCell
              label={priceLabel(result.model)}
              cost={result.usage.cost}
              latencyMs={result.latencyMs}
            />
          </dl>

          {jevAnswers ? (
            <ComparisonTable
              rows={compareAll(questions, jevAnswers, result.answers)}
            />
          ) : null}

          <Projected usage={result.usage} servedModel={result.model} />

          <p className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
            Prompts are not token-identical — a question set is terser than a
            written prompt — so this is a real head-to-head, not a controlled
            experiment.
          </p>
        </>
      )}
    </div>
  )
}

/** One measured column: what a model cost and how long it took. */
function MeasuredCell({
  label,
  cost,
  latencyMs,
}: {
  label: string
  cost?: number
  latencyMs?: number
}) {
  return (
    <div className="px-3.5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs">
        <span className="tabular text-ink">
          {cost !== undefined ? usd(cost) : "—"}
        </span>
        {latencyMs !== undefined ? (
          <span className="tabular text-ink-muted">{ms(latencyMs)}</span>
        ) : null}
      </dd>
    </div>
  )
}

/** Per-question agreement, as data. No column claims a right answer. */
function ComparisonTable({
  rows,
}: {
  rows: ReturnType<typeof compareAll>
}) {
  return (
    <div className="divide-y divide-[var(--hairline)]">
      {rows.map((row) => (
        <div
          key={row.name}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 px-3.5 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-xs text-ink">{row.name}</div>
            <div className="tabular mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-ink-muted">
              <span>Jev {row.jev}</span>
              <span>Baseline {row.baseline}</span>
            </div>
          </div>
          {row.agree ? (
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
      ))}
    </div>
  )
}

/** What the same token count would cost on the frontier models, projected. */
function Projected({
  usage,
  servedModel,
}: {
  usage: JevUsage
  servedModel: string
}) {
  const others = Object.values(CHAT_PRICES).filter(
    (price) => price.model !== servedModel,
  )
  if (others.length === 0) return null

  return (
    <div className="border-t border-[var(--hairline)] px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
        <Minus className="size-3" aria-hidden />
        Projected on other models
      </div>
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {others.map((price) => (
          <div key={price.model} className="inline-flex items-baseline gap-1.5">
            <dt className="text-ink-muted">{price.label}</dt>
            <dd className="tabular text-ink">{usd(projectCost(usage, price))}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function priceLabel(model: string): string {
  return CHAT_PRICES[model]?.label ?? model
}
