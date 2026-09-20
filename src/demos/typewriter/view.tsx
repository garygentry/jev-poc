import { ConfidenceMeter } from "@/components/jev/ConfidenceMeter"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ProbabilityBar } from "@/components/jev/ProbabilityBar"
import { Card } from "@/components/ui/card"
import { humanize } from "@/lib/format"
import { isUndecided, rankedProbabilities } from "@shared/jev.ts"

import { manifest } from "./demo"

import type { JevAnswer } from "@shared/jev.ts"

export function Meters({ answers }: { answers: Record<string, JevAnswer> }) {
  const choices = Object.entries(manifest.questions).filter(
    ([, question]) => question.type === "choice",
  )
  const scores = Object.entries(manifest.questions).filter(
    ([, question]) => question.type === "score",
  )
  const nouls = Object.entries(manifest.questions).filter(
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
            const undecided = isUndecided(answer)
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
