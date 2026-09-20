import { HelpCircle, Route as RouteIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { usd } from "@/lib/format"
import { cn } from "@/lib/utils"
import { JEV_USD_PER_INPUT_TOKEN } from "@shared/jev.ts"

import { LADDER, MODELS, TYPICAL_REQUEST, costPerRequest } from "./models"
import { chooseModel } from "./policy"

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

/** Projections are quoted over this many requests to be legible. */
const VOLUME = 1_000

export function Verdict({
  route,
  usage,
}: {
  route: ReturnType<typeof chooseModel>
  usage?: { input_tokens: number }
}) {
  const chosen = MODELS[route.model]
  const opus = MODELS.opus

  const chosenCost = costPerRequest(chosen) * VOLUME
  const opusCost = costPerRequest(opus) * VOLUME
  const saved = opusCost - chosenCost

  // What the routing itself costs, at the size of the request Jev actually saw.
  const routerCost = usage
    ? usage.input_tokens * JEV_USD_PER_INPUT_TOKEN * VOLUME
    : null

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <RouteIcon className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <span className="font-mono text-sm font-medium text-ink">{chosen.id}</span>
        {route.clarifyFirst ? (
          <Badge variant="warning">
            <HelpCircle aria-hidden />
            Clarify before sending
          </Badge>
        ) : null}
        <div className="flex w-full flex-wrap gap-1.5">
          {route.reasons.map((reason) => (
            <Badge key={reason} variant="outline">
              {reason}
            </Badge>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--hairline)] p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          Projected over {VOLUME.toLocaleString()} requests like this one
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
          <Figure label={`Routed to ${chosen.name}`} value={usd(chosenCost)} />
          <Figure label="Always Opus 5" value={usd(opusCost)} />
          <Figure
            label="Difference"
            value={saved > 0 ? `${usd(saved)} saved` : "none"}
            emphasis
          />
          {routerCost !== null ? (
            <Figure label="Jev's own cost" value={usd(routerCost)} />
          ) : null}
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
          Assumes a request of {TYPICAL_REQUEST.inputTokens.toLocaleString()} input
          and {TYPICAL_REQUEST.outputTokens.toLocaleString()} output tokens —
          an assumption, not a measurement. Model prices are dated external data
          (read 2026-06-24) and will go stale.
          {routerCost !== null && saved > 0 ? (
            <>
              {" "}
              The routing costs about{" "}
              <span className="text-ink-secondary">
                {(routerCost / saved) * 100 < 1
                  ? "under 1%"
                  : `${((routerCost / saved) * 100).toFixed(1)}%`}
              </span>{" "}
              of what it saves.
            </>
          ) : null}
        </p>
      </div>
    </Card>
  )
}

function Figure({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 text-sm font-medium",
          emphasis ? "text-[var(--mark)]" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function Ladder({ route }: { route: ReturnType<typeof chooseModel> }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-4 py-2.5 sm:px-5">
        <h4 className="text-xs font-medium text-ink">The ladder</h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Cheapest first. Every rule can only raise the floor, never lower it,
          so their order does not change the outcome.
        </p>
      </div>
      <ul className="divide-y divide-[var(--hairline)]">
        {LADDER.map((key) => {
          const model = MODELS[key]
          const active = key === route.model
          return (
            <li
              key={key}
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
                {model.id}
              </span>
              <span className="tabular ml-auto text-[11px] text-ink-muted">
                ${model.inputPerMTok}/${model.outputPerMTok} per MTok ·{" "}
                {(model.contextTokens / 1000).toLocaleString()}k ctx
              </span>
              <span className="tabular w-20 shrink-0 text-right text-[11px] text-ink-muted">
                {usd(costPerRequest(model) * VOLUME)}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
