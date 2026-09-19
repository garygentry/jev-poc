import { useEffect, useMemo, useState } from "react"
import { CircleSlash, HelpCircle, ShieldCheck } from "lucide-react"

import { AnswerCard } from "@/components/jev/AnswerCard"
import { PolicyTrace } from "@/components/jev/PolicyTrace"
import { WirePanel } from "@/components/jev/WirePanel"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote, RunBar } from "@/components/layout/RunBar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { demoBySlug } from "@/demos/registry"
import { useJev } from "@/lib/use-jev"
import { cn } from "@/lib/utils"

import { QUESTIONS } from "./questions"
import { COMMANDS, stateFor } from "./examples"
import { RADIUS_POLICY, rule, type Verdict } from "./policy"

const demo = demoBySlug("guardrail")!

export default function GuardrailDemo() {
  const [selected, setSelected] = useState(COMMANDS[0]!.id)
  const { data, error, loading, run } = useJev()

  const command = COMMANDS.find((item) => item.id === selected)!

  useEffect(() => {
    void run(stateFor(command), QUESTIONS, `guardrail/${command.id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const ruling = useMemo(() => {
    if (!data) return null
    try {
      return rule(data.answers)
    } catch {
      return null
    }
  }, [data])

  const radiusGate = (() => {
    const answer = data?.answers.blast_radius
    if (answer?.type !== "choice") return undefined
    const policy = RADIUS_POLICY[answer.choice]
    return policy && "allowAt" in policy ? policy.allowAt : undefined
  })()

  return (
    <DemoFrame demo={demo}>
      <RunBar
        examples={COMMANDS.map((item) => ({ id: item.id, label: item.label }))}
        selected={selected}
        onSelect={setSelected}
        onRun={() => void run(stateFor(command), QUESTIONS, `guardrail/${command.id}`)}
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
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                About to run in /home/dev/acme-api (branch main)
              </p>
              <pre className="mt-2 overflow-x-auto font-mono text-sm text-ink">
                $ {command.command}
              </pre>
            </div>
          </Card>

          {ruling ? <VerdictCard ruling={ruling} /> : null}
          <GateTable selected={data?.answers.blast_radius} />
          {ruling ? <PolicyTrace lines={ruling.trace} /> : null}
          {data ? <WirePanel wire={data.wire} /> : null}
        </div>

        <div className="min-w-0 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-ink-muted">
            Six properties, one request
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
                    threshold={name === "blast_radius" ? radiusGate : undefined}
                  />
                )
              })
            : null}
        </div>
      </div>
    </DemoFrame>
  )
}

/**
 * `mark` is the filled/border colour; `ink` is the same hue stepped for text.
 * On the light surface the mark steps for warning and serious fall below 3:1 by
 * design — fine for a chip, unreadable as a word.
 */
const VERDICT_STYLE: Record<
  Verdict,
  { label: string; mark: string; ink: string; Icon: typeof ShieldCheck }
> = {
  allow: {
    label: "Allow",
    mark: "var(--status-good)",
    ink: "var(--status-good-ink)",
    Icon: ShieldCheck,
  },
  ask: {
    label: "Ask first",
    mark: "var(--status-warning)",
    ink: "var(--status-warning-ink)",
    Icon: HelpCircle,
  },
  deny: {
    label: "Refuse",
    mark: "var(--status-critical)",
    ink: "var(--status-critical-ink)",
    Icon: CircleSlash,
  },
}

function VerdictCard({ ruling }: { ruling: ReturnType<typeof rule> }) {
  const { label, mark, ink, Icon } = VERDICT_STYLE[ruling.verdict]

  return (
    <Card style={{ borderColor: `color-mix(in srgb, ${mark} 35%, transparent)` }}>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {/* Icon and word alongside the color: the status never reads on hue. */}
        <Icon className="mt-0.5 size-5 shrink-0" style={{ color: ink }} aria-hidden />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold" style={{ color: ink }}>
            {label}
          </p>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {ruling.reason}
          </p>
          {ruling.flags.length ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {ruling.flags.map((flag) => (
                <Badge key={flag} variant="outline" className="capitalize">
                  {flag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

/**
 * The gate table, shown because it is the argument the demo is making.
 *
 * Seeing `read_only` and `catastrophic` demand different things of the same
 * confidence number is more convincing than reading a sentence about it.
 */
function GateTable({ selected }: { selected?: { type: string; choice?: string } }) {
  const current = selected?.type === "choice" ? selected.choice : undefined

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-4 py-2.5 sm:px-5">
        <h4 className="text-xs font-medium text-ink">
          Confidence needed to auto-allow
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Scaled to what being wrong would cost, not set once for everything.
        </p>
      </div>
      <ul className="divide-y divide-[var(--hairline)]">
        {Object.entries(RADIUS_POLICY).map(([radius, policy]) => (
          <li
            key={radius}
            className={cn(
              "flex items-center gap-3 px-4 py-2 text-sm sm:px-5",
              current === radius && "bg-[var(--mark)]/10",
            )}
          >
            <span
              className={cn(
                "font-mono text-xs capitalize",
                current === radius ? "text-ink" : "text-ink-secondary",
              )}
            >
              {radius.replace(/_/g, " ")}
            </span>
            <span className="tabular ml-auto text-xs">
              {"allowAt" in policy ? (
                <span className="text-ink">
                  {Math.round(policy.allowAt * 100)}%
                </span>
              ) : policy.never === "ask" ? (
                <span className="text-[var(--status-warning-ink)]">always asks</span>
              ) : (
                <span className="text-[var(--status-critical-ink)]">refused</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
