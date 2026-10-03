import { beforeEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RatingSnapshotInsert } from '../recalculateRatings'
import { recalculateDynamicRatings } from '../recalculateRatings'
import { loadCurrentRatingSnapshots } from '../rating-snapshot-diff'

const networkRow: RatingSnapshotInsert = { player_id: 'a', match_id: 'm', snapshot_date: '2026-06-01', rating_type: 'overall', track: 'tiq', dynamic_rating: 4.6, delta: 0.1, opponent_rating: 4.7, win_probability: null, multiplier: null }
vi.mock('../tiq-live-network', () => ({
  loadLiveNetworkEvidence: async () => ({ excluded: new Set(), priors: new Map() }),
  orientReviewedLiveScores: async (_client: unknown, rows: unknown) => rows,
  calculateLiveNetwork: () => ({ snapshots: [networkRow], model: 'fixture', predictions: [], skippedMatches: [] }),
  applyLiveNetworkPlayers: (players: unknown) => players,
}))
vi.mock('../tiq-source-owned-courts', () => ({ loadSourceOwnedCourts: async () => new Set() }))
vi.mock('../rating-snapshot-diff', async importOriginal => ({ ...await importOriginal<typeof import('../rating-snapshot-diff')>(), loadCurrentRatingSnapshots: vi.fn() }))

function fixture(failure?: 'write' | 'constraint') {
  const events: Array<{ operation: string; table: string; rows?: RatingSnapshotInsert[]; ids?: string[] }> = []
  const tables: Record<string, unknown[]> = {
    players: ['a','b'].map(id => ({ id, name: id, rating_source: 'verified', singles_rating: 4.5, doubles_rating: 4.5, overall_rating: 4.5 })),
    matches: [{ id: 'm', match_date: '2026-06-01', match_type: 'singles', winner_side: 'A', score: '6-4 6-4', rating_eligible: true }],
    match_players: [{ match_id: 'm', player_id: 'a', side: 'A', seat: 1 }, { match_id: 'm', player_id: 'b', side: 'B', seat: 1 }],
  }
  const client = { from(table: string) {
    const query = {
      select: () => query, not: () => query, eq: () => query, order: () => query, gte: () => query,
      range: async (start: number, end: number) => ({ data: tables[table].slice(start, end + 1), error: null }),
      upsert: async (rows: RatingSnapshotInsert[]) => {
        events.push({ operation: 'upsert', table, rows })
        return { error: table === 'rating_snapshots' && failure ? { message: failure === 'write' ? 'write failed' : 'no unique or exclusion constraint matching the ON CONFLICT specification' } : null }
      },
      insert: async (rows: RatingSnapshotInsert[]) => { events.push({ operation: 'insert', table, rows }); return { error: null } },
      delete: () => query,
      in: async (_column: string, ids: string[]) => { events.push({ operation: 'delete', table, ids }); return { error: null } },
    }
    return query
  } } as unknown as SupabaseClient
  return { client, events }
}
const options = { engine: 'network' as const, now: Date.parse('2026-06-02T00:00:00Z') }
beforeEach(() => {
  vi.mocked(loadCurrentRatingSnapshots).mockReset()
  vi.mocked(loadCurrentRatingSnapshots).mockResolvedValue([{ ...networkRow, id: 'kept' }, { ...networkRow, match_id: 'stale', id: 'stale' }])
})

it('keeps identical network history and deletes stale IDs only after writes complete', async () => {
  const data = fixture()
  await recalculateDynamicRatings(undefined, data.client, options)
  const snapshots = data.events.filter(e => e.table === 'rating_snapshots')
  expect(snapshots.filter(e => e.operation === 'upsert').flatMap(e => e.rows ?? []).some(r => r.track === 'tiq' && r.player_id === 'a' && r.rating_type === 'overall')).toBe(false)
  expect(snapshots.at(-1)).toEqual({ operation: 'delete', table: 'rating_snapshots', ids: ['stale'] })
})

it('does not publish players or history if the inventory read fails', async () => {
  vi.mocked(loadCurrentRatingSnapshots).mockRejectedValue(new Error('statement timeout'))
  const data = fixture()
  await expect(recalculateDynamicRatings(undefined, data.client, options)).rejects.toThrow('statement timeout')
  expect(data.events).toEqual([])
})

it('preserves old history when a changed-row write fails', async () => {
  const data = fixture('write')
  await expect(recalculateDynamicRatings(undefined, data.client, options)).rejects.toThrow('write failed')
  expect(data.events.some(e => e.operation === 'delete')).toBe(false)
})

it('replaces only exact changed keys when the unique-constraint insert fallback is needed', async () => {
  vi.mocked(loadCurrentRatingSnapshots).mockResolvedValue([{ ...networkRow, dynamic_rating: 4.4, id: 'changed' }, { ...networkRow, match_id: 'stale', id: 'stale' }])
  const data = fixture('constraint')
  await recalculateDynamicRatings(undefined, data.client, options)
  expect(data.events.filter(e => e.operation === 'delete').map(e => e.ids)).toEqual([['changed'], ['stale']])
  expect(data.events.findIndex(e => e.operation === 'delete' && e.ids?.includes('changed'))).toBeLessThan(data.events.findIndex(e => e.operation === 'insert'))
})

it('retains full replacement behavior for schemas without snapshot metrics', async () => {
  vi.mocked(loadCurrentRatingSnapshots).mockRejectedValue(new Error('column rating_snapshots.delta does not exist'))
  const data = fixture()
  await recalculateDynamicRatings(undefined, data.client, options)
  expect(data.events.some(e => e.operation === 'delete' && e.ids?.includes('a'))).toBe(true)
})
