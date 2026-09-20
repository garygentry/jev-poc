import { ArrowRight, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

import type { Ticket } from "./demo"
import type { Routed } from "./policy"

/** The ticket under judgement, shown while the request is still in flight. */
export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
          <Badge variant="outline">{ticket.customer.plan}</Badge>
          <span>{ticket.customer.tenure_months} months</span>
          <span>·</span>
          <span>{ticket.customer.prior_tickets} prior tickets</span>
        </div>
        <h3 className="mt-2 text-sm font-medium text-ink">{ticket.subject}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
          {ticket.body}
        </p>
      </div>
    </Card>
  )
}

/**
 * Where the ticket went, and whether a person has to look first.
 *
 * The notes are annotations rather than reasons: they say what the answers
 * contained, while the trace below says which branch acted on them.
 */
export function Verdict({ routed }: { routed: Routed }) {
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
