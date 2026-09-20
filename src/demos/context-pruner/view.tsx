import { Check, Loader2, Scissors, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ms, percent, usd } from "@/lib/format"
import { cn } from "@/lib/utils"

import { CHAT_PRICES } from "@shared/baseline.ts"
import type { AnswerSource, JevUsage } from "@shared/jev.ts"

import type { Scenario } from "./context"
import { tokensOf } from "./context"
import { KEEP_THRESHOLD, type Judged, type Pruned } from "./policy"

/** The frontier model a whole context would otherwise be sent to, every turn. */
const DOWNSTREAM = CHAT_PRICES["anthropic/claude-opus-5"]
const perToken = (DOWNSTREAM?.inputPerM ?? 0) / 1_000_000

/** The task the context is being pruned for. */
export function GoalCard({ goal }: { goal: string }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">The goal</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{goal}</p>
      </div>
    </Card>
  )
}

/**
 * The saving, told tokens-first.
 *
 * The headline is deterministic and needs no key: the tokens of the chunks
 * dropped are tokens a downstream call never carries. The dollar figures are a
 * *projection* — measured token counts against a stated frontier price — and
 * the gate's own measured cost is shown only against a live run, because a
 * replayed fan-out spent nothing.
 */
export function Savings({
  pruned,
  usage,
  wallClockMs,
  calls,
  source,
}: {
  pruned: Pruned
  usage?: JevUsage
  wallClockMs?: number
  calls?: number
  source?: AnswerSource
}) {
  const { totalTokens, keptTokens, droppedTokens, keptCount, droppedCount } = pruned
  const savedFraction = totalTokens > 0 ? droppedTokens / totalTokens : 0
  const live = source === "live"

  const fullCost = totalTokens * perToken
  const prunedCost = keptTokens * perToken
  const savedPerTurn = droppedTokens * perToken

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">The saving is the tokens not sent</h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Dropped chunks are tokens a downstream call never carries. Counts are
          exact; the dollar figures are that count against a stated frontier price.
        </p>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)]">
        <Stat label="Full context" value={`${totalTokens.toLocaleString()} tok`} sub={`${keptCount + droppedCount} chunks`} />
        <Stat label="After pruning" value={`${keptTokens.toLocaleString()} tok`} sub={`${keptCount} kept`} />
        <Stat
          label="Not sent"
          value={`${droppedTokens.toLocaleString()} tok`}
          sub={`${droppedCount} dropped · ${percent(savedFraction, 0)}`}
          emphasis
        />
      </dl>

      {live && usage ? (
        <div className="space-y-2 px-3.5 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Jev pruned it for
            </span>
            <span className="tabular text-ink">{usd(usage.cost)}</span>
            {wallClockMs !== undefined ? (
              <span className="tabular text-ink-muted">{ms(wallClockMs)}</span>
            ) : null}
            {calls !== undefined ? (
              <span className="text-ink-muted">{calls} calls</span>
            ) : null}
            <span className="text-[10px] normal-case text-ink-muted/80">measured</span>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <Money label="Full context → Opus, per turn" value={fullCost} />
            <Money label="Pruned → Opus, per turn" value={prunedCost} />
            <Money label="Saved per turn" value={savedPerTurn} emphasis />
          </dl>

          <p className="text-[11px] leading-relaxed text-ink-muted">
            An agent re-sends its context every turn, so the per-turn saving
            compounds — the pruning is paid once, at {usd(usage.cost)}, and the
            frontier price ({DOWNSTREAM?.label}, ${DOWNSTREAM?.inputPerM}/M input)
            is dated external data used only to project, never a measured cost.
          </p>
        </div>
      ) : (
        <p className="px-3.5 py-2.5 text-[11px] text-ink-muted">
          The token saving above is exact and needs no key. The dollar
          projection and Jev's own measured cost appear against a live run.
        </p>
      )}
    </Card>
  )
}

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string
  value: string
  sub: string
  emphasis?: boolean
}) {
  return (
    <div className="px-3.5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "tabular mt-1 text-sm font-medium",
          emphasis ? "text-[var(--mark)]" : "text-ink",
        )}
      >
        {value}
      </dd>
      <dd className="mt-0.5 text-[11px] text-ink-muted">{sub}</dd>
    </div>
  )
}

function Money({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("tabular", emphasis ? "text-[var(--mark)]" : "text-ink")}>
        {usd(value)}
      </dd>
    </div>
  )
}

/**
 * Every chunk, in context order, with the relevance the gate gave it and where
 * the threshold put it. Dropped chunks are dimmed but never hidden — the demo's
 * whole claim is *what* it drops, so hiding them would hide the evidence.
 */
export function ChunkList({
  scenario,
  judged,
  loading,
}: {
  scenario: Scenario
  judged: Map<string, Judged> | null
  loading: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3.5 py-2.5">
        <Scissors className="size-3.5 text-ink-muted" aria-hidden />
        <h4 className="text-xs font-medium text-ink">The context, chunk by chunk</h4>
        {loading ? (
          <Loader2 className="ml-auto size-3.5 animate-spin text-ink-muted" aria-hidden />
        ) : null}
      </div>

      <ul className="divide-y divide-[var(--hairline)]">
        {scenario.chunks.map((chunk) => {
          const verdict = judged?.get(chunk.id)
          const kept = verdict
            ? verdict.relevance === null || verdict.relevance >= KEEP_THRESHOLD
            : null
          return (
            <li
              key={chunk.id}
              className={cn("px-3.5 py-3", kept === false && "opacity-55")}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-ink">{chunk.label}</span>
                <span className="tabular text-[11px] text-ink-muted">
                  {tokensOf(chunk.text).toLocaleString()} tok
                </span>
                {kept !== null ? (
                  <span className="ml-auto">
                    {kept ? (
                      <Badge variant="mark" className="gap-1">
                        <Check aria-hidden />
                        keep
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <X aria-hidden />
                        drop
                      </Badge>
                    )}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-secondary">
                {chunk.text}
              </p>
              {verdict && verdict.relevance !== null ? (
                <NoulGauge
                  label="relevant to the goal"
                  value={verdict.relevance}
                  threshold={KEEP_THRESHOLD}
                  className="mt-2"
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
