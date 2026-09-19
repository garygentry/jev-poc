import { useEffect, useRef, useState } from "react"

import { ConfidenceMeter } from "@/components/jev/ConfidenceMeter"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ProbabilityBar } from "@/components/jev/ProbabilityBar"
import { Sparkline } from "@/components/jev/Sparkline"
import { WirePanel } from "@/components/jev/WirePanel"
import { SourceBadge } from "@/components/jev/Readouts"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote } from "@/components/layout/RunBar"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { demoBySlug } from "@/demos/registry"
import { useJev } from "@/lib/use-jev"
import { humanize } from "@/lib/format"
import { rankedProbabilities } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"
import { cn } from "@/lib/utils"

import { QUESTIONS } from "./questions"
import { DRAFTS } from "./examples"

const demo = demoBySlug("typewriter")!

/**
 * How long a pause counts as "stopped typing".
 *
 * Long enough that a request is not fired per keystroke, short enough that the
 * panel feels attached to the text. The in-flight request is aborted on every
 * new one anyway, so an over-eager debounce costs latency rather than money.
 */
const DEBOUNCE_MS = 260

/** Below this there is not enough text for any judgement to mean anything. */
const MIN_CHARS = 40

export default function TypewriterDemo() {
  const [text, setText] = useState(DRAFTS[0]!.text)
  const [selected, setSelected] = useState<string | null>(DRAFTS[0]!.id)
  const { data, error, loading, history, run, reset } = useJev({
    cancelPrevious: true,
  })

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)

    if (text.trim().length < MIN_CHARS) {
      reset()
      return
    }

    timer.current = setTimeout(() => {
      void run({ draft: text }, QUESTIONS, selected ? `typewriter/${selected}` : undefined)
    }, DEBOUNCE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, selected])

  const tooShort = text.trim().length < MIN_CHARS

  return (
    <DemoFrame demo={demo}>
      <div className="flex flex-wrap gap-1.5">
        {DRAFTS.map((draft) => (
          <button
            key={draft.id}
            type="button"
            onClick={() => {
              setSelected(draft.id)
              setText(draft.text)
            }}
            aria-pressed={selected === draft.id}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              selected === draft.id
                ? "border-[var(--mark)] bg-[var(--mark)]/10 text-ink"
                : "border-[var(--hairline)] text-ink-secondary hover:border-[var(--mark)]/40 hover:text-ink",
            )}
          >
            {draft.label}
          </button>
        ))}
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="draft"
                  className="text-xs font-medium text-ink"
                >
                  Your draft
                </label>
                <span className="flex items-center gap-2">
                  {data ? <SourceBadge source={data.source} /> : null}
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      loading ? "bg-[var(--mark)]" : "bg-[var(--axis)]",
                    )}
                    aria-label={loading ? "Asking" : "Idle"}
                  />
                </span>
              </div>

              <Textarea
                id="draft"
                value={text}
                onChange={(event) => {
                  setSelected(null)
                  setText(event.target.value)
                }}
                rows={9}
                placeholder="Start typing. Twelve judgements re-answer on every pause…"
                className="min-h-48 resize-y font-sans leading-relaxed"
              />

              <p className="tabular text-[11px] text-ink-muted">
                {text.trim().length} characters
                {tooShort ? ` — ${MIN_CHARS} needed before asking` : null}
              </p>
            </div>
          </Card>

          <Card>
            <div className="p-4 sm:p-5">
              <Sparkline values={history} label="Round trip" />
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                One request carries all twelve questions. Asking the twelfth
                costs roughly what asking the first costs, which is the only
                reason a panel like this can exist.
              </p>
            </div>
          </Card>

          {data ? <WirePanel wire={data.wire} /> : null}
        </div>

        <div className="min-w-0 space-y-3">
          {tooShort || !data ? (
            <Card>
              <p className="p-6 text-center text-sm text-ink-muted">
                {tooShort
                  ? "Waiting for enough text to judge."
                  : "Asking…"}
              </p>
            </Card>
          ) : (
            <Meters answers={data.answers} />
          )}
        </div>
      </div>
    </DemoFrame>
  )
}

function Meters({ answers }: { answers: Record<string, JevAnswer> }) {
  const choices = Object.entries(QUESTIONS).filter(
    ([, question]) => question.type === "choice",
  )
  const scores = Object.entries(QUESTIONS).filter(
    ([, question]) => question.type === "score",
  )
  const nouls = Object.entries(QUESTIONS).filter(
    ([, question]) => question.type === "noul",
  )

  return (
    <>
      {choices.map(([name]) => {
        const answer = answers[name]
        if (answer?.type !== "choice") return null
        return (
          <Card key={name}>
            <div className="space-y-2.5 p-3.5">
              <h4 className="font-mono text-[11px] text-ink">{name}</h4>
              {rankedProbabilities(answer.probabilities).map((entry) => (
                <ProbabilityBar
                  key={entry.key}
                  label={entry.key}
                  probability={entry.probability}
                  emphasised={entry.key === answer.choice}
                />
              ))}
              <ConfidenceMeter confidence={answer.confidence} />
            </div>
          </Card>
        )
      })}

      <Card>
        <div className="space-y-3.5 p-3.5">
          <h4 className="text-[11px] uppercase tracking-wide text-ink-muted">
            Scores
          </h4>
          {scores.map(([name, question]) => {
            const answer = answers[name]
            if (answer?.type !== "score" || question.type !== "score") return null
            const top = Math.max(1, question.criteria.length - 1)
            const undecided = answer.confidence <= 0.05
            return (
              <div key={name} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink-secondary">
                    {name}
                  </span>
                  <span className="tabular text-xs font-medium text-ink">
                    {undecided ? "—" : `${answer.score.toFixed(2)} / ${top}`}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--gridline)]">
                  {undecided ? null : (
                    <div
                      className="h-full rounded-full bg-[var(--mark)] transition-[width] duration-200 ease-out"
                      style={{ width: `${(answer.score / top) * 100}%` }}
                    />
                  )}
                </div>
                <p className="text-[10px] leading-snug text-ink-muted">
                  {undecided
                    ? "Flat distribution — cannot tell."
                    : question.criteria[Math.round(answer.score)]}
                </p>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="space-y-3 p-3.5">
          <h4 className="text-[11px] uppercase tracking-wide text-ink-muted">
            Checks
          </h4>
          {nouls.map(([name]) => {
            const answer = answers[name]
            if (answer?.type !== "noul") return null
            return (
              <NoulGauge key={name} label={humanize(name)} value={answer.noul} />
            )
          })}
        </div>
      </Card>
    </>
  )
}
