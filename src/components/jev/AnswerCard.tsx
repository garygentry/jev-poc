import { rankedProbabilities } from "@shared/jev.ts"
import type { JevAnswer, JevQuestion } from "@shared/jev.ts"

import { ConfidenceMeter } from "./ConfidenceMeter"
import { NoulGauge } from "./NoulGauge"
import { ProbabilityBar } from "./ProbabilityBar"
import { ScoreRail } from "./ScoreRail"
import { cn } from "@/lib/utils"
import { humanize } from "@/lib/format"

interface AnswerCardProps {
  name: string
  question: JevQuestion
  answer: JevAnswer
  /** The gate this answer must clear in the demo's policy, if it has one. */
  threshold?: number
  className?: string
}

/**
 * One question's answer, rendered by primitive.
 *
 * A Choice shows its full distribution, not just the winner — the runner-up's
 * share is what tells you whether the top answer was a near thing, and it is
 * the number most worth seeing.
 */
export function AnswerCard({
  name,
  question,
  answer,
  threshold,
  className,
}: AnswerCardProps) {
  return (
    <div className={cn("panel p-3.5", className)}>
      <div className="mb-2.5">
        <h4 className="font-mono text-[11px] text-ink">{name}</h4>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
          {question.instructions}
        </p>
      </div>

      {answer.type === "choice" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {rankedProbabilities(answer.probabilities).map((entry) => (
              <ProbabilityBar
                key={entry.key}
                label={entry.key}
                probability={entry.probability}
                emphasised={entry.key === answer.choice}
                caption={
                  question.type === "choice"
                    ? question.criteria[entry.key]
                    : undefined
                }
              />
            ))}
          </div>
          <ConfidenceMeter confidence={answer.confidence} threshold={threshold} />
        </div>
      ) : null}

      {answer.type === "score" ? (
        <div className="space-y-3">
          <ScoreRail
            answer={answer}
            criteria={question.type === "score" ? question.criteria : undefined}
          />
          <ConfidenceMeter confidence={answer.confidence} />
        </div>
      ) : null}

      {answer.type === "noul" ? (
        <NoulGauge
          label={humanize(name)}
          value={answer.noul}
          threshold={threshold}
        />
      ) : null}
    </div>
  )
}
