import { useEffect, useMemo, useState } from "react"
import { HelpCircle, Route as RouteIcon } from "lucide-react"

import { AnswerCard } from "@/components/jev/AnswerCard"
import { PolicyTrace } from "@/components/jev/PolicyTrace"
import { WirePanel } from "@/components/jev/WirePanel"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote, RunBar } from "@/components/layout/RunBar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { demoBySlug } from "@/demos/registry"
import { useJev } from "@/lib/use-jev"
import { usd } from "@/lib/format"
import { cn } from "@/lib/utils"
import { JEV_USD_PER_INPUT_TOKEN } from "@shared/jev.ts"

import { QUESTIONS } from "./questions"
import { PROMPTS, stateFor } from "./examples"
import { LADDER, MODELS, TYPICAL_REQUEST, costPerRequest } from "./models"
import { TRUSTED_CONFIDENCE, chooseModel } from "./policy"

const demo = demoBySlug("router")!

/** Projections are quoted over this many requests to be legible. */
const VOLUME = 1_000

export default function RouterDemo() {
  const [selected, setSelected] = useState(PROMPTS[0]!.id)
  const { data, error, loading, run } = useJev()

  const prompt = PROMPTS.find((item) => item.id === selected)!

  useEffect(() => {
    void run(stateFor(prompt), QUESTIONS, `router/${prompt.id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const route = useMemo(() => {
    if (!data) return null
    try {
      return chooseModel(data.answers)
    } catch {
      return null
    }
  }, [data])

  return (
    <DemoFrame demo={demo}>
      <RunBar
        examples={PROMPTS.map((item) => ({ id: item.id, label: item.label }))}
        selected={selected}
        onSelect={setSelected}
        onRun={() => void run(stateFor(prompt), QUESTIONS, `router/${prompt.id}`)}
        loading={loading}
        runLabel="Re-ask"
        latencyMs={data?.latencyMs}
        usage={data?.usage}
        calls={data ? 1 : undefined}
        source={data?.source}
      />

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                Incoming request
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink">
                {prompt.text}
              </p>
            </div>
          </Card>

          {route ? (
            <Verdict
              route={route}
              // Only a live response carries a token count this app measured;
              // a fixture's is written down, not observed.
              usage={data?.source === "live" ? data.usage : undefined}
            />
          ) : null}
          {route ? <Ladder route={route} /> : null}
          {route ? <PolicyTrace lines={route.trace} /> : null}
          {data ? <WirePanel wire={data.wire} /> : null}
        </div>

        <div className="min-w-0 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-ink-muted">
            What the router asked
          </h3>
          {data
            ? Object.entries(QUESTIONS).map(([name, question]) => {
                const answer = data.answers[name]
                if (!answer) return null
                return (
                  <AnswerCard
                    key={name}
                    name={name}
                    question={question}
                    answer={answer}
                    threshold={
                      name === "required_capability" ? TRUSTED_CONFIDENCE : undefined
                    }
                  />
                )
              })
            : null}
        </div>
      </div>
    </DemoFrame>
  )
}

function Verdict({
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

function Ladder({ route }: { route: ReturnType<typeof chooseModel> }) {
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
