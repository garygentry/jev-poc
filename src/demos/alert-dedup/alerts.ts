import type { BatchItem, JevState } from "@shared/jev.ts"

/** One alert as it arrives on the wire: a short label and the message. */
export interface Alert {
  id: string
  /** A short handle for the row. */
  label: string
  /** The alert text a dedup rule or a human would read. */
  text: string
}

export interface Storm {
  id: string
  label: string
  alerts: Alert[]
}

/** What the gate judges: two alerts, side by side. */
export const stateFor = (a: Alert, b: Alert): JevState => ({
  alert_a: a.text,
  alert_b: b.text,
})

/** A stable id for the unordered pair (i, j). */
export const pairId = (a: Alert, b: Alert): string => `${a.id}--${b.id}`

/**
 * Every unordered pair of alerts in a storm — the N-choose-2 the gate compares.
 *
 * The order is fixed (i before j) so the fixture key a pair records under is the
 * same one the UI asks for, and the clustering reads the same edges every time.
 */
export const pairsOf = (storm: Storm): BatchItem[] => {
  const items: BatchItem[] = []
  for (let i = 0; i < storm.alerts.length; i += 1) {
    for (let j = i + 1; j < storm.alerts.length; j += 1) {
      const a = storm.alerts[i]!
      const b = storm.alerts[j]!
      items.push({ id: pairId(a, b), state: stateFor(a, b) })
    }
  }
  return items
}

/**
 * The template a classic dedup rule would key on: the message with its variable
 * parts blanked out.
 *
 * This is the baseline the demo is measured against, so it is deliberately a
 * faithful version of the real thing — lowercase, blank any token carrying a
 * digit (counts, versions, hosts like `cache-2`), blank the service named after
 * `on`/`for`, and keep the leading words. It is exactly this that groups two
 * unrelated "p99 > 5s" alerts because they share a shape, and splits one
 * incident across three alerts because they do not — the failure a "same
 * incident?" question does not have.
 */
export const templateOf = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\b(on|for)\s+[\w.-]+/g, "$1 #") // the service/host after on/for
    .replace(/\b[\w.-]*\d[\w.-]*\b/g, "#") // any token with a digit
    .replace(/[^a-z#\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ")

/**
 * Two alert storms, each mixing one real incident spread across several alerts
 * with unrelated noise and a template look-alike.
 *
 * The look-alike is the point: `checkout` and `search` both fire "p99 > 5s",
 * so a template rule groups them though they are different services failing for
 * different reasons — while the real incident (a database pool exhausted,
 * surfacing as checkout latency and order 503s) is split across three unlike
 * messages a template rule never joins. "Same incident?" gets both right.
 */
export const STORMS: Storm[] = [
  {
    id: "db-pool",
    label: "A database pool exhaustion",
    alerts: [
      {
        id: "checkout-latency",
        label: "checkout latency",
        text: "HighLatency: p99 above 5s on checkout-service; requests are slow acquiring a database connection",
      },
      {
        id: "db-pool",
        label: "db pool exhausted",
        text: "DBPoolExhausted: primary-db connection pool at 100 of 100, clients queueing for a connection",
      },
      {
        id: "orders-503",
        label: "orders 503s",
        text: "UpstreamTimeout: orders-service returning 503 as primary-db connection attempts time out",
      },
      {
        id: "search-latency",
        label: "search latency",
        text: "HighLatency: p99 above 5s on search-service; elasticsearch query latency high, unrelated to the primary database",
      },
      {
        id: "disk",
        label: "disk usage",
        text: "DiskUsageHigh: disk at 92 percent on logs-worker-3, retention cleanup lagging",
      },
      {
        id: "cert",
        label: "cert expiry",
        text: "CertExpiringSoon: TLS certificate for api.example.com expires in 6 days",
      },
    ],
  },
  {
    id: "bad-deploy",
    label: "A bad deploy",
    alerts: [
      {
        id: "error-spike",
        label: "error-rate spike",
        text: "ErrorRateHigh: api-gateway error rate jumped to 12 percent at 14:02, climbing since the last release",
      },
      {
        id: "deploy",
        label: "deploy event",
        text: "DeployCompleted: version 4.7.0 of api-gateway went live at 14:01, one minute before errors began",
      },
      {
        id: "handler-500",
        label: "handler 500s",
        text: "ServerErrors: api-gateway 5xx spike, 500s traced to the new v2 handler shipped in this release",
      },
      {
        id: "backup",
        label: "backup failed",
        text: "JobFailed: nightly backup db-snapshot failed after a 30m timeout, unrelated to serving traffic",
      },
      {
        id: "cache-mem",
        label: "cache memory",
        text: "MemoryHigh: memory at 85 percent on cache-2, within normal range for peak hours",
      },
    ],
  },
]
