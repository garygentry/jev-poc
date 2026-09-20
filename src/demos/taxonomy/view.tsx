import { CheckCircle2, CircleDot, Scissors } from "lucide-react"

import { UsageReadout } from "@/components/jev/Readouts"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ms, percent } from "@/lib/format"
import { cn } from "@/lib/utils"

import { LEAF_COUNT, labelAt } from "./taxonomy"
import {
  BEAM_WIDTH,
  DESCEND_CONFIDENCE,
  PRUNE_BELOW,
  beatGreedy,
  type Branch,
} from "./beam"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

/** The ticket under judgement, and what a human filed it as beforehand. */
export function TicketCard({ text, expected }: { text: string; expected: string }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          Ticket
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{text}</p>
        <p className="mt-2 text-[11px] text-ink-muted">
          Filed by hand as{" "}
          <span className="font-mono text-ink-secondary">{expected}</span>, before
          any run.
        </p>
      </div>
    </Card>
  )
}

export function Settings() {
  return (
    <Card>
      <div className="flex flex-wrap gap-x-8 gap-y-3 p-4 sm:p-5">
        <Setting
          label="Beam width"
          value={String(BEAM_WIDTH)}
          note="branches carried between rounds"
        />
        <Setting
          label="Prune below"
          value={percent(PRUNE_BELOW, 0)}
          note="cumulative path probability"
        />
        <Setting
          label="Descend above"
          value={percent(DESCEND_CONFIDENCE, 0)}
          note="confidence, or commit here"
        />
        <Setting
          label="Leaves"
          value={String(LEAF_COUNT)}
          note="vs one flat choice of 40"
        />
      </div>
    </Card>
  )
}

function Setting({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium text-ink">{value}</p>
      <p className="text-[10px] text-ink-muted">{note}</p>
    </div>
  )
}

export function Outcome({
  rounds,
  winner,
  requests,
  usage,
  wallClockMs,
  source,
}: {
  rounds: Branch[][]
  winner: Branch | null
  requests: number
  usage?: JevUsage
  wallClockMs?: number
  source?: AnswerSource
}) {
  if (!winner) return null

  const committedEarly = winner.stoppedBecause === "flat"

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Committed to
          </p>
          <p className="mt-0.5 font-mono text-sm font-medium text-ink">
            {labelAt(winner.path) || "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Path probability
          </p>
          <p className="tabular mt-0.5 text-sm font-medium text-ink">
            {percent(winner.probability, 1)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Requests
          </p>
          <p className="tabular mt-0.5 text-sm font-medium text-ink">
            {requests}{" "}
            <span className="font-normal text-ink-muted">
              for {rounds.length} levels
            </span>
          </p>
        </div>
        {source === "live" && wallClockMs !== undefined ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">
              Wall clock
            </p>
            <p className="tabular mt-0.5 text-sm font-medium text-ink">
              {ms(wallClockMs)}
            </p>
          </div>
        ) : null}
        {source === "live" && usage ? (
          <div className="ml-auto">
            <UsageReadout usage={usage} calls={requests} />
          </div>
        ) : null}
      </div>

      {committedEarly ? (
        <div className="border-t border-[var(--hairline)] px-4 py-2.5 sm:px-5">
          <p className="text-[11px] leading-relaxed text-ink-secondary">
            <span className="font-medium text-ink">Stopped above a leaf.</span>{" "}
            The distribution over this node's children was flatter than the{" "}
            {percent(DESCEND_CONFIDENCE, 0)} descend threshold, so it committed
            here rather than guessing. An interior node is a real answer — it
            routes correctly, where a guessed leaf would only do so by luck.
          </p>
        </div>
      ) : null}

      <div className="border-t border-[var(--hairline)] px-4 py-2.5 sm:px-5">
        <p className="text-[11px] leading-relaxed text-ink-secondary">
          {beatGreedy(rounds, winner) ? (
            <>
              <span className="font-medium text-ink">
                The beam earned its keep here.
              </span>{" "}
              The winning path is not the one greedy descent would have taken —
              a branch that was behind at some level came back to win on
              cumulative probability.
            </>
          ) : (
            <>
              <span className="font-medium text-ink">
                Greedy would have reached the same leaf.
              </span>{" "}
              On this input the beam bought nothing — the argmax won at every
              level. The extra branches cost a few more questions inside the
              same requests, which is the premium you pay for the inputs where
              it does matter.
            </>
          )}
        </p>
      </div>
    </Card>
  )
}

export function Tree({
  rounds,
  winner,
}: {
  rounds: Branch[][]
  winner: Branch | null
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-4 py-3 sm:px-5">
        <h3 className="text-sm font-medium text-ink">The beam, level by level</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
          Every question in a round shares the ticket as its state, so each level
          is <strong className="text-ink-secondary">one request</strong> no matter
          how wide the beam. Widening it buys more questions, not more round
          trips.
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
          On a clear ticket Jev returns a probability of{" "}
          <span className="font-mono text-ink-secondary">1.0</span> and the beam
          collapses to a single branch — there is nothing for it to carry. It
          only does visible work where the model is genuinely torn, which is the
          honest answer to “was the beam worth it”: sometimes, and the tree
          below shows which.
        </p>
      </div>

      <div className="divide-y divide-[var(--hairline)]">
        {rounds.map((branches, depth) => (
          <div key={depth} className="p-4 sm:p-5">
            <p className="mb-2.5 text-[11px] uppercase tracking-wide text-ink-muted">
              Level {depth + 1} · one request
            </p>
            <ul className="space-y-1.5">
              {[...branches]
                .sort((a, b) => b.probability - a.probability)
                .map((branch) => (
                  <BranchRow
                    key={branch.path.join("/") || "root"}
                    branch={branch}
                    isWinner={
                      winner?.path.join("/") === branch.path.join("/")
                    }
                  />
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BranchRow({ branch, isWinner }: { branch: Branch; isWinner: boolean }) {
  const dropped = branch.stoppedBecause === "beam"

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md px-2.5 py-1.5",
        isWinner && "bg-[var(--mark)]/10",
        dropped && "opacity-45",
      )}
    >
      <span className="w-40 shrink-0">
        <span
          className="block h-1.5 rounded-full"
          style={{
            width: `${Math.max(2, branch.probability * 100)}%`,
            backgroundColor: dropped ? "var(--axis)" : "var(--mark)",
          }}
        />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-xs",
          isWinner ? "text-ink" : "text-ink-secondary",
        )}
      >
        {labelAt(branch.path) || "root"}
      </span>
      <span className="tabular shrink-0 text-[11px] text-ink-muted">
        {percent(branch.probability, 1)}
      </span>
      <StopReason branch={branch} />
    </li>
  )
}

function StopReason({ branch }: { branch: Branch }) {
  if (!branch.stoppedBecause) {
    return <span className="w-24 shrink-0" />
  }

  const map = {
    leaf: { label: "leaf", Icon: CheckCircle2 },
    flat: { label: "flat — commit", Icon: CircleDot },
    beam: { label: "outside beam", Icon: Scissors },
    pruned: { label: "pruned", Icon: Scissors },
  } as const

  const { label, Icon } = map[branch.stoppedBecause]

  return (
    <Badge variant="outline" className="w-auto shrink-0 gap-1">
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}
