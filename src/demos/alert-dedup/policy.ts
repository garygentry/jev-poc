import { templateOf, type Alert } from "./alerts"

/**
 * The confidence at which a pair is treated as one incident.
 *
 * A genuine "maybe" (a noul near the middle) should not fuse two incidents, so
 * the bar sits above a coin flip: merging is the consequential move — it hides
 * one alert behind another — and the safe default when the gate is unsure is to
 * keep them apart and let a human see both. The [[threshold-fitter]] demo will
 * later fit this against labelled storms.
 */
export const MERGE_THRESHOLD = 0.6

/** One compared pair and the gate's answer (null if it never came back). */
export interface Edge {
  a: string
  b: string
  noul: number | null
}

/**
 * Cluster alerts into incidents from the pairwise edges.
 *
 * A plain union-find: every alert starts alone, and each pair the gate scored at
 * or above the threshold merges its two. Connected components are incidents, so
 * transitivity is free — if a links to b and b to c, all three land together
 * even if the a–c pair was itself below the bar. A missing edge never merges,
 * which is the safe default: silence keeps two alerts apart.
 *
 * Clusters come back in the order the alerts were given, each ordered the same
 * way, so the output is stable for the view and the tests.
 */
export function cluster(
  alertIds: string[],
  edges: Edge[],
  threshold = MERGE_THRESHOLD,
): string[][] {
  const parent = new Map<string, string>(alertIds.map((id) => [id, id]))
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    // Path compression keeps repeated lookups flat.
    let cur = x
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const edge of edges) {
    if (edge.noul !== null && edge.noul >= threshold) union(edge.a, edge.b)
  }

  const groups = new Map<string, string[]>()
  for (const id of alertIds) {
    const root = find(id)
    const group = groups.get(root)
    if (group) group.push(id)
    else groups.set(root, [id])
  }
  return [...groups.values()]
}

/**
 * How a classic template rule would group the same alerts: by shared template.
 *
 * The baseline the demo is measured against. Same stable ordering as `cluster`,
 * so the two can be laid side by side row for row.
 */
export function templateGroups(alerts: Alert[]): string[][] {
  const groups = new Map<string, string[]>()
  const order: string[] = []
  for (const alert of alerts) {
    const key = templateOf(alert.text)
    const group = groups.get(key)
    if (group) group.push(alert.id)
    else {
      groups.set(key, [alert.id])
      order.push(key)
    }
  }
  return order.map((key) => groups.get(key)!)
}

/** Which alerts are grouped with which, as a lookup from alert id to its group index. */
export function groupIndex(groups: string[][]): Map<string, number> {
  const index = new Map<string, number>()
  groups.forEach((group, i) => group.forEach((id) => index.set(id, i)))
  return index
}
