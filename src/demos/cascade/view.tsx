import { Check, Loader2, Play, Route as RouteIcon, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ErrorNote } from "@/components/layout/RunBar"
import { ms, usd } from "@/lib/format"
import { cn } from "@/lib/utils"

import { CHAT_PRICES } from "@shared/baseline.ts"
import type { BaselineAnswer } from "@shared/baseline.ts"
import type { JevQuestionSet, JevUsage } from "@shared/jev.ts"

import { TIER_MODEL, tierLabel, type Cascade, type Tier } from "./policy"
import type { CascadeWork } from "./useCascadeWork"

/** The request about to be routed, shown before anything has judged it. */
export function RequestCard({ text }: { text: string }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          Incoming request
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{text}</p>
      </div>
    </Card>
  )
}

const LADDER: Tier[] = ["haiku", "opus"]

/** Which tier the gate chose, why, and the two rungs it chose between. */
export function TierVerdict({ cascade }: { cascade: Cascade }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <RouteIcon className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <span className="font-mono text-sm font-medium text-ink">
          {TIER_MODEL[cascade.tier]}
        </span>
        <div className="flex w-full flex-wrap gap-1.5">
          {cascade.reasons.map((reason) => (
            <Badge key={reason} variant="outline">
              {reason}
            </Badge>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--hairline)]">
        <ul className="divide-y divide-[var(--hairline)]">
          {LADDER.map((tier) => {
            const price = CHAT_PRICES[TIER_MODEL[tier]]
            const active = tier === cascade.tier
            return (
              <li
                key={tier}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-5",
                  active && "bg-[var(--mark)]/10",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-xs",
                    active ? "text-ink" : "text-ink-secondary",
                  )}
                >
                  {TIER_MODEL[tier]}
                </span>
                {active ? (
                  <Badge variant="mark" className="font-mono">
                    chosen
                  </Badge>
                ) : null}
                {price ? (
                  <span className="tabular ml-auto text-[11px] text-ink-muted">
                    ${price.inputPerM}/${price.outputPerM} per MTok
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}

/**
 * The measured head-to-head: what the cascade actually spent, against sending
 * everything to the frontier.
 *
 * Both columns are real `usage`, never projected — that is the whole point of
 * the demo. It only renders against a live gate, because a replayed gate spent
 * no money and running the workers beside it would compare a real bill with a
 * recording.
 */
export function CascadeResult({
  work,
  cascade,
  gateUsage,
  gateLatencyMs,
  questions,
  live,
}: {
  work: CascadeWork
  cascade: Cascade
  gateUsage?: JevUsage
  gateLatencyMs?: number
  questions: JevQuestionSet
  /** The gate answers came from the live model; only then is a bill real. */
  live: boolean
}) {
  if (!live) return null

  const { worker, opus, loading, error, run } = work

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">
          The work, measured on both tiers
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          The gate chose {tierLabel(cascade.tier)}. Run the actual triage on that
          tier and on Opus, and compare what each cost — every figure from usage.
        </p>
      </div>

      {!worker || !opus ? (
        <div className="space-y-3 px-3.5 py-3">
          <Badge variant="warning" className="gap-1.5">
            Spends real money on {cascade.tier === "opus" ? "Opus" : "two chat models"}
          </Badge>
          <div>
            <Button size="sm" onClick={run} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
              {loading ? "Running the work…" : "Run the work"}
            </Button>
          </div>
          {error ? <ErrorNote message={error} /> : null}
        </div>
      ) : (
        <Settled
          worker={worker}
          opus={opus}
          cascade={cascade}
          gateUsage={gateUsage}
          gateLatencyMs={gateLatencyMs}
          questions={questions}
        />
      )}
    </Card>
  )
}

function Settled({
  worker,
  opus,
  cascade,
  gateUsage,
  gateLatencyMs,
  questions,
}: {
  worker: NonNullable<CascadeWork["worker"]>
  opus: NonNullable<CascadeWork["opus"]>
  cascade: Cascade
  gateUsage?: JevUsage
  gateLatencyMs?: number
  questions: JevQuestionSet
}) {
  const gateCost = gateUsage?.cost ?? 0
  const cascadeCost = gateCost + worker.usage.cost
  const opusEverything = opus.usage.cost
  const ratio = cascadeCost > 0 ? opusEverything / cascadeCost : null
  const routedToOpus = cascade.tier === "opus"

  return (
    <>
      <dl className="grid grid-cols-2 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)]">
        <Cell
          label={`Cascade · gate + ${tierLabel(cascade.tier)}`}
          cost={cascadeCost}
          latencyMs={
            gateLatencyMs !== undefined
              ? gateLatencyMs + worker.latencyMs
              : worker.latencyMs
          }
        />
        <Cell label="Opus on everything" cost={opusEverything} latencyMs={opus.latencyMs} />
      </dl>

      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Result</dt>
        <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {routedToOpus ? (
            <span className="text-sm text-ink">
              Routed to the frontier — no saving here, by design
            </span>
          ) : ratio !== null && ratio > 1 ? (
            <span className="tabular text-sm font-medium text-[var(--mark)]">
              {ratio.toFixed(ratio >= 10 ? 0 : 1)}× cheaper than always-Opus
            </span>
          ) : (
            <span className="text-sm text-ink-muted">no measured saving</span>
          )}
          <span className="text-[11px] text-ink-muted">
            gate {usd(gateCost)} + work {usd(worker.usage.cost)}
          </span>
        </dd>
      </div>

      <TierComparison
        questions={questions}
        worker={worker.answers}
        opus={opus.answers}
        routedToOpus={routedToOpus}
        tier={cascade.tier}
      />

      <p className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
        No answer is scored as correct — there is no ground truth here. The table
        shows where the tiers agreed, as data. Prompts are terser than a written
        one, so this is a real head-to-head, not a controlled experiment.
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

/** Where the chosen tier and Opus landed together on the actual task. As data. */
function TierComparison({
  questions,
  worker,
  opus,
  routedToOpus,
  tier,
}: {
  questions: JevQuestionSet
  worker: Record<string, BaselineAnswer>
  opus: Record<string, BaselineAnswer>
  routedToOpus: boolean
  tier: Tier
}) {
  if (routedToOpus) {
    return (
      <p className="px-3.5 py-2.5 text-[11px] text-ink-muted">
        The gate sent this to Opus, so the two columns are the same call — there
        is nothing to compare, and that is the honest result on a hard request.
      </p>
    )
  }

  const rows = Object.keys(questions).map((name) => {
    const a = worker[name]
    const b = opus[name]
    return { name, agree: a && b ? agree(a, b) : false, worker: a, opus: b }
  })

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
              <span>
                {tierLabel(tier)} {row.worker ? show(row.worker) : "—"}
              </span>
              <span>Opus {row.opus ? show(row.opus) : "—"}</span>
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

/** Do two baseline answers point the same way? A loose test, never a score. */
function agree(a: BaselineAnswer, b: BaselineAnswer): boolean {
  if (a.type === "choice" && b.type === "choice") return a.choice === b.choice
  if (a.type === "score" && b.type === "score") return a.score === b.score
  if (a.type === "noul" && b.type === "noul") return a.noul >= 0.5 === b.noul >= 0.5
  return false
}

function show(answer: BaselineAnswer): string {
  if (answer.type === "choice") return answer.choice
  if (answer.type === "score") return String(answer.score)
  return answer.noul.toFixed(2)
}
