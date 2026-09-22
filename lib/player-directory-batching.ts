export const PLAYER_DIRECTORY_QUERY_BATCH_SIZE = 120
export const PLAYER_DIRECTORY_QUERY_CONCURRENCY = 4

export function chunkPlayerIds(playerIds: string[], size = PLAYER_DIRECTORY_QUERY_BATCH_SIZE) {
  const chunks: string[][] = []

  for (let index = 0; index < playerIds.length; index += size) {
    chunks.push(playerIds.slice(index, index + size))
  }

  return chunks
}

export async function loadPlayerDirectoryBatches<T>(
  playerIds: string[],
  loadBatch: (playerIds: string[]) => Promise<T[]>,
  concurrency = PLAYER_DIRECTORY_QUERY_CONCURRENCY,
) {
  const rows: T[] = []
  const batches = chunkPlayerIds(playerIds)

  for (let index = 0; index < batches.length; index += concurrency) {
    const loaded = await Promise.all(batches.slice(index, index + concurrency).map(loadBatch))
    for (const batchRows of loaded) rows.push(...batchRows)
  }

  return rows
}
