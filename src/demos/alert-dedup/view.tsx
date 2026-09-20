import type { ReactNode } from "react"

import { Layers, Loader2, Tag } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ms, usd } from "@/lib/format"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

import type { Alert, Storm } from "./alerts"
import { groupIndex } from "./policy"

/** The alerts as they arrived, before anything has grouped them. */
export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">{alerts.length} alerts, as they fired</h4>
      </div>
      <ul className="divide-y divide-[var(--hairline)]">
        {alerts.map((alert) => (
          <li key={alert.id} className="px-3.5 py-2">
            <p className="text-[11px] leading-relaxed text-ink-secondary">{alert.text}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/**
 * The two groupings side by side: incidents from "same incident?", and the
 * groups a template rule keys out of the message shape.
 *
 * The contrast is the whole demo, so both are always shown and the template
 * side's mistakes are named rather than hidden — a group that fuses two
 * incidents, and an incident the rule scattered across groups.
 */
export function Comparison({
  storm,
  incidents,
  templates,
  usage,
  wallClockMs,
  calls,
  source,
}: {
  storm: Storm
  incidents: string[][]
  templates: string[][]
  usage?: JevUsage
  wallClockMs?: number
  calls?: number
  source?: AnswerSource
}) {
  const byId = new Map(storm.alerts.map((a) => [a.id, a]))
  const incidentOf = groupIndex(incidents)
  const templateOfId = groupIndex(templates)
  const live = source === "live"

  // A template group is a false merge when its alerts belong to >1 incident.
  const falseMerge = (group: string[]) =>
    new Set(group.map((id) => incidentOf.get(id))).size > 1
  // An incident is split when its alerts land in >1 template group.
  const splitCount = incidents.filter(
    (inc) => new Set(inc.map((id) => templateOfId.get(id))).size > 1,
  ).length

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">
          {incidents.length} incidents, not {templates.length} template groups
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          The template rule merges alerts that share a shape and splits an
          incident whose alerts read differently. "Same incident?" does neither.
        </p>
      </div>

      <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2">
        <Column
          icon={<Layers className="size-3.5 text-[var(--mark)]" aria-hidden />}
          title="Grouped by incident — Jev"
        >
          {incidents.map((group, i) => (
            <GroupCard key={i} label={`Incident ${i + 1}`} alerts={group.map((id) => byId.get(id)!)} />
          ))}
        </Column>

        <Column
          icon={<Tag className="size-3.5 text-ink-muted" aria-hidden />}
          title="Grouped by template — the rule"
        >
          {templates.map((group, i) => (
            <GroupCard
              key={i}
              label={`Template ${i + 1}`}
              alerts={group.map((id) => byId.get(id)!)}
              warn={falseMerge(group) ? "merges 2 incidents" : undefined}
            />
          ))}
        </Column>
      </div>

      <div className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
        The template rule fuses {templates.filter(falseMerge).length} unrelated group
        {templates.filter(falseMerge).length === 1 ? "" : "s"} and scatters{" "}
        {splitCount} incident{splitCount === 1 ? "" : "s"} across rows.
        {live && usage ? (
          <>
            {" "}Jev compared {calls ?? 0} pairs for{" "}
            <span className="tabular text-ink">{usd(usage.cost)}</span>
            {wallClockMs !== undefined ? (
              <span className="tabular"> in {ms(wallClockMs)}</span>
            ) : null}{" "}
            <span className="text-[10px]">measured</span>.
          </>
        ) : (
          <> The grouping needs no key; Jev's measured cost shows on a live run.</>
        )}
      </div>
    </Card>
  )
}

function Column({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-3.5 py-2">
        {icon}
        <h5 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{title}</h5>
      </div>
      <div className="space-y-2 px-3.5 pb-3">{children}</div>
    </div>
  )
}

function GroupCard({
  label,
  alerts,
  warn,
}: {
  label: string
  alerts: Alert[]
  warn?: string
}) {
  return (
    <div className="rounded-md border border-[var(--hairline)] px-3 py-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] font-medium text-ink">{label}</span>
        <span className="text-[10px] text-ink-muted">
          {alerts.length} alert{alerts.length === 1 ? "" : "s"}
        </span>
        {warn ? (
          <Badge variant="warning" className="ml-auto text-[10px]">
            {warn}
          </Badge>
        ) : null}
      </div>
      <ul className="space-y-0.5">
        {alerts.map((alert) => (
          <li key={alert.id} className="truncate text-[11px] text-ink-secondary">
            {alert.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A small spinner row while the pairs are being compared. */
export function ComparingNote() {
  return (
    <Card>
      <div className="flex items-center gap-2 px-3.5 py-3 text-[11px] text-ink-muted">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Comparing every pair…
      </div>
    </Card>
  )
}
