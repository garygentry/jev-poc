import { useEffect, useMemo, useState } from "react"
import { ArrowRight, UserRound } from "lucide-react"

import { AnswerCard } from "@/components/jev/AnswerCard"
import { PolicyTrace } from "@/components/jev/PolicyTrace"
import { WirePanel } from "@/components/jev/WirePanel"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote, RunBar } from "@/components/layout/RunBar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { demoBySlug } from "@/demos/registry"
import { useJev } from "@/lib/use-jev"

import { QUESTIONS } from "./questions"
import { TICKETS, stateFor } from "./examples"
import { BILLING_CONFIDENCE, ROUTABLE_CONFIDENCE, route } from "./policy"

const demo = demoBySlug("triage")!

export default function TriageDemo() {
  const [selected, setSelected] = useState(TICKETS[0]!.id)
  const { data, error, loading, run } = useJev()

  const ticket = TICKETS.find((item) => item.id === selected)!

  useEffect(() => {
    void run(stateFor(ticket), QUESTIONS, `triage/${ticket.id}`)
    // Re-asking on ticket change is the whole interaction; `run` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const routed = useMemo(() => {
    if (!data) return null
    try {
      return route(data.answers)
    } catch {
      return null
    }
  }, [data])

  const departmentGate =
    routed && data?.answers.department?.type === "choice"
      ? data.answers.department.choice === "billing"
        ? BILLING_CONFIDENCE
        : ROUTABLE_CONFIDENCE
      : undefined

  return (
    <DemoFrame demo={demo}>
      <RunBar
        examples={TICKETS.map((item) => ({ id: item.id, label: item.label }))}
        selected={selected}
        onSelect={setSelected}
        onRun={() => void run(stateFor(ticket), QUESTIONS, `triage/${ticket.id}`)}
        loading={loading}
        runLabel="Re-ask"
        latencyMs={data?.latencyMs}
        usage={data?.usage}
        calls={data ? 1 : undefined}
        source={data?.source}
      />

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                <Badge variant="outline">{ticket.customer.plan}</Badge>
                <span>{ticket.customer.tenure_months} months</span>
                <span>·</span>
                <span>{ticket.customer.prior_tickets} prior tickets</span>
              </div>
              <h3 className="mt-2 text-sm font-medium text-ink">
                {ticket.subject}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                {ticket.body}
              </p>
            </div>
          </Card>

          {routed ? <Verdict routed={routed} /> : null}
          {routed ? <PolicyTrace lines={routed.trace} /> : null}
          {data ? <WirePanel wire={data.wire} /> : null}
        </div>

        <div className="min-w-0 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-ink-muted">
            Seven answers, one request
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
                    threshold={name === "department" ? departmentGate : undefined}
                  />
                )
              })
            : null}
        </div>
      </div>
    </DemoFrame>
  )
}

function Verdict({ routed }: { routed: ReturnType<typeof route> }) {
  const { decision } = routed

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <ArrowRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <span className="font-mono text-sm font-medium text-ink">
          {decision.queue}
        </span>
        {decision.human ? (
          <Badge variant="warning">
            <UserRound aria-hidden />
            Human first
          </Badge>
        ) : (
          <Badge variant="good">Auto-routed</Badge>
        )}

        {decision.notes.length ? (
          <div className="flex w-full flex-wrap gap-1.5">
            {decision.notes.map((note) => (
              <Badge key={note} variant="outline">
                {note}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
