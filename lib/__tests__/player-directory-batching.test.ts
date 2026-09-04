import { describe, expect, it } from 'vitest'
import {
  chunkPlayerIds,
  loadPlayerDirectoryBatches,
  PLAYER_DIRECTORY_QUERY_BATCH_SIZE,
} from '@/lib/player-directory-batching'

describe('player directory batching', () => {
  it('keeps Supabase in filters safely below the request-url limit', () => {
    const ids = Array.from({ length: 1000 }, (_, index) => `player-${index}`)
    const batches = chunkPlayerIds(ids)

    expect(batches).toHaveLength(Math.ceil(ids.length / PLAYER_DIRECTORY_QUERY_BATCH_SIZE))
    expect(Math.max(...batches.map((batch) => batch.length))).toBe(PLAYER_DIRECTORY_QUERY_BATCH_SIZE)
    expect(batches.flat()).toEqual(ids)
  })

  it('preserves every loaded row while limiting each concurrent wave', async () => {
    const ids = Array.from({ length: PLAYER_DIRECTORY_QUERY_BATCH_SIZE * 2 + 1 }, (_, index) => `player-${index}`)
    const received: string[][] = []
    let activeRequests = 0
    let maximumConcurrentRequests = 0

    const rows = await loadPlayerDirectoryBatches(
      ids,
      async (batch) => {
        activeRequests += 1
        maximumConcurrentRequests = Math.max(maximumConcurrentRequests, activeRequests)
        received.push(batch)
        await new Promise((resolve) => setTimeout(resolve, 1))
        activeRequests -= 1
        return batch.map((id) => ({ id }))
      },
      2,
    )

    expect(received).toHaveLength(3)
    expect(maximumConcurrentRequests).toBeLessThanOrEqual(2)
    expect(rows).toEqual(ids.map((id) => ({ id })))
  })
})
