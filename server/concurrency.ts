/**
 * Run `worker` over every item, never more than `limit` at once.
 *
 * Results come back in input order regardless of completion order, which
 * matters because the re-rank and persona demos zip them back against their
 * source lists by index.
 *
 * A rejected worker is not allowed to abort the run: in a wide fan-out a single
 * transient upstream error would otherwise discard every sibling result that
 * had already been paid for. Failures are captured per item instead.
 *
 * @param items Inputs, one per call.
 * @param limit Maximum simultaneous workers. Clamped to at least 1.
 * @param worker Called once per item.
 * @param onProgress Invoked after each settle, for the progress bar.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void,
): Promise<Array<{ value: R } | { error: Error }>> {
  const width = Math.max(1, Math.min(limit, items.length || 1))
  const results = new Array<{ value: R } | { error: Error }>(items.length)
  let next = 0
  let completed = 0

  async function run(): Promise<void> {
    while (true) {
      const index = next
      next += 1
      if (index >= items.length) return

      try {
        results[index] = { value: await worker(items[index] as T, index) }
      } catch (error) {
        results[index] = {
          error: error instanceof Error ? error : new Error(String(error)),
        }
      }

      completed += 1
      onProgress?.(completed, items.length)
    }
  }

  await Promise.all(Array.from({ length: width }, run))
  return results
}
