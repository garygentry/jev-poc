/**
 * The one place a fixture key is built.
 *
 * The server stores fixtures flat, keyed `demo/entry`, assembling that from the
 * file name (`fixtures/triage.json`) and the entry inside it. Every caller used
 * to spell the key out by hand — five sites across the demos and
 * `scripts/capture.ts`. A key that a runner writes one way and `capture` writes
 * another does not error: the lookup simply misses and the request falls
 * through to the synthetic path, which is shaped exactly like a real response
 * and means nothing at all. That silent downgrade already happened once.
 *
 * So the two halves are defined together here. Nothing else may build one.
 */

/**
 * The key *inside* `fixtures/<slug>.json`, which is what `pnpm capture` writes.
 *
 * @param part For demos whose example fans out into several recorded calls —
 *   one per passage, one per persona — where the example alone is not unique.
 */
export const entryKey = (exampleId: string, part?: string): string =>
  part ? `${exampleId}/${part}` : exampleId

/**
 * The key a request sends, which is what the server looks up.
 *
 * A fan-out sends this *without* a part and the batch route appends each row's
 * id, which composes to exactly what `fixtureKey(slug, example, row)` spells —
 * the one composition that happens outside this file, in `server/routes.ts`.
 */
export const fixtureKey = (
  slug: string,
  exampleId: string,
  part?: string,
): string => `${slug}/${entryKey(exampleId, part)}`

/**
 * One round of a sequential walk.
 *
 * A round is not a part of its example: the questions asked at depth 2 depend
 * on what came back at depth 1, so each round is its own recording. The depth
 * suffix rather than a path segment is what the committed fixtures already use.
 */
export const roundEntry = (exampleId: string, depth: number): string =>
  entryKey(`${exampleId}-d${depth}`)

export const roundKey = (slug: string, exampleId: string, depth: number): string =>
  `${slug}/${roundEntry(exampleId, depth)}`
