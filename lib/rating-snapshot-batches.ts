/** Disjoint snapshot keys only. Drain the entire wave before throwing so the
 * caller cannot release its import/rating lock while a write is still active. */
export async function saveRatingSnapshotBatches<T>(
  batches: T[],
  save: (batch: T) => Promise<void>,
  concurrency: 1 | 2 = 1,
) {
  const width = concurrency === 2 ? 2 : 1
  for (let start = 0; start < batches.length; start += width) {
    const settled = await Promise.allSettled(
      batches.slice(start, start + width).map(async batch => save(batch)),
    )
    const failed = settled.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
  }
}
