import { Ban, Eye, Loader2, Play, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ErrorNote } from "@/components/layout/RunBar"
import type { BaselineController } from "@/demos/_kit"
import { ms, usd } from "@/lib/format"
import { cn } from "@/lib/utils"

import { CHAT_PRICES } from "@shared/baseline.ts"
import type { JevUsage } from "@shared/jev.ts"

import type { Content } from "./content"
import { ACTION_LABEL, type Action, type Decision, type Moderation } from "./policy"

const BASELINE = CHAT_PRICES["anthropic/claude-haiku-4.5"]

/** The content under review. */
export function ContentCard({ content }: { content: Content }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">The content</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{content.text}</p>
      </div>
    </Card>
  )
}

const ACTION_BADGE: Record<Action, "mark" | "outline" | "warning"> = {
  allow: "mark",
  review: "outline",
  block: "warning",
}

/** The action, and which policies drove it. */
export function Verdict({ moderation }: { moderation: Moderation }) {
  const { action, tripped } = moderation
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 p-4">
        {action === "block" ? (
          <Ban className="size-4 shrink-0 text-[var(--status-warning-ink)]" aria-hidden />
        ) : action === "review" ? (
          <Eye className="size-4 shrink-0 text-ink-muted" aria-hidden />
        ) : (
          <ShieldCheck className="size-4 shrink-0 text-[var(--mark)]" aria-hidden />
        )}
        <Badge variant={ACTION_BADGE[action]}>{ACTION_LABEL[action]}</Badge>
        <span className="min-w-0 text-xs text-ink-secondary">
          {tripped.length === 0
            ? "no policy tripped"
            : `${tripped.length} tripped: ${tripped.map((d) => d.policy.label).join(", ")}`}
        </span>
      </div>
    </Card>
  )
}

/**
 * All twelve policies at once, each with its own threshold on its own gauge.
 *
 * The whole set is shown, tripped or not, because the claim is that all twelve
 * were answered in one request — hiding the quiet ones would hide the batching.
 * Tripped policies are lifted out of the grid; the rest stay legible but dim.
 */
export function PolicyMatrix({ decisions }: { decisions: Decision[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">
          Twelve policies, one request
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Each gauge shows the policy's probability against its own threshold (the tick).
        </p>
      </div>
      <div className="grid gap-x-6 gap-y-3 p-3.5 sm:grid-cols-2">
        {decisions.map((d) => (
          <div
            key={d.policy.key}
            className={cn(
              "rounded-md px-2 py-1.5",
              d.tripped && "bg-[var(--status-warning-ink)]/5 ring-1 ring-[var(--status-warning-ink)]/30",
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className={cn("text-[11px] font-medium", d.tripped ? "text-ink" : "text-ink-secondary")}>
                {d.policy.label}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-ink-muted">
                {d.policy.severity}
              </span>
              {d.tripped ? (
                <Badge variant="warning" className="ml-auto text-[9px]">
                  tripped
                </Badge>
              ) : null}
            </div>
            {d.probability !== null ? (
              <NoulGauge label="" value={d.probability} threshold={d.policy.threshold} />
            ) : (
              <p className="text-[10px] text-ink-muted">unanswered</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * The same twelve policies, measured against a chat model.
 *
 * Both answer all twelve in one structured request, so this is the honest
 * head-to-head for the batching claim: one call each, and the cost gap is the
 * price of the model. Live-only, because a replayed gate spent nothing.
 */
export function MeasuredComparison({
  baseline,
  gateUsage,
  gateLatencyMs,
  live,
}: {
  baseline: BaselineController
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
          All twelve, measured against a chat model
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          {BASELINE?.label} answers the same twelve policies in one structured
          request. A naive baseline would send twelve prompts instead.
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
              {loading ? "Moderating…" : `Run on ${BASELINE?.label}`}
            </Button>
          </div>
          {error ? <ErrorNote message={error} /> : null}
        </div>
      ) : (
        (() => {
          const gateCost = gateUsage?.cost ?? 0
          const ratio = gateCost > 0 ? result.usage.cost / gateCost : null
          return (
            <>
              <dl className="grid grid-cols-2 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)]">
                <Cell label="Jev · 12 in 1 request" cost={gateCost} latencyMs={gateLatencyMs} />
                <Cell label={`${BASELINE?.label} · 12 in 1`} cost={result.usage.cost} latencyMs={result.latencyMs} />
              </dl>
              <div className="px-3.5 py-2.5">
                <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {ratio !== null && ratio > 1 ? (
                    <span className="tabular text-sm font-medium text-[var(--mark)]">
                      {ratio.toFixed(ratio >= 10 ? 0 : 1)}× cheaper, same one request
                    </span>
                  ) : (
                    <span className="text-sm text-ink-muted">no measured saving</span>
                  )}
                  <span className="text-[11px] text-ink-muted">
                    and a per-prompt baseline would be 12× either figure
                  </span>
                </dd>
              </div>
            </>
          )
        })()
      )}
    </Card>
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
