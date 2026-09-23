import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, it } from 'vitest'
import { recalculateDynamicRatings } from '../recalculateRatings'

type Mode = 'modern' | 'metrics-missing' | 'constraint-missing' | 'both-missing'
function fixture(mode: Mode, failFirstSnapshot = false) {
  const tables: Record<string, unknown[]> = {
    players: ['a', 'b', 'c', 'd'].map(id => ({ id, name: 'Fixture', rating_source: 'verified', singles_rating: 4, doubles_rating: 4, overall_rating: 4 })),
    matches: Array.from({ length: 180 }, (_, i) => ({ id: `m${i}`, match_date: '2026-09-04', match_type: i % 2 ? 'singles' : 'doubles', score: '6-4 3-6 1-0', winner_side: i % 2 ? 'A' : 'B', rating_eligible: true })),
    match_players: Array.from({ length: 180 }, (_, i) => (i % 2 ? ['a', 'b'] : ['a', 'b', 'c', 'd']).map((id, seat) => ({ match_id: `m${i}`, player_id: id, side: i % 2 ? (seat ? 'B' : 'A') : (seat < 2 ? 'A' : 'B'), seat: seat % (i % 2 ? 1 : 2) + 1 }))).flat(),
  }
  const writes: Array<{ table: string; operation: string; rows: unknown[]; options?: unknown }> = []
  let active = 0, maximum = 0, snapshotRequests = 0
  async function write(table: string, operation: string, rows: unknown[], options?: unknown) {
    writes.push({ table, operation, rows, options })
    if (table !== 'rating_snapshots') return { error: null }
    const request = ++snapshotRequests
    active++; maximum = Math.max(maximum, active)
    await new Promise(resolve => setTimeout(resolve, failFirstSnapshot && request === 2 ? 20 : 1))
    active--
    if (failFirstSnapshot && request === 1) return { error: { message: 'storage write failed' } }
    if (operation === 'upsert' && (mode === 'constraint-missing' || mode === 'both-missing')) return { error: { message: 'no unique or exclusion constraint matching the ON CONFLICT specification' } }
    if ((mode === 'metrics-missing' || mode === 'both-missing') && 'delta' in (rows[0] as object)) return { error: { message: 'column delta is missing' } }
    return { error: null }
  }
  const client = { from(table: string) {
    const query = {
      select: () => query, not: () => query, eq: () => query, order: () => query,
      range: (start: number, end: number) => Promise.resolve({ data: (tables[table] || []).slice(start, end + 1), error: null }),
      upsert: (rows: unknown[], options?: unknown) => write(table, 'upsert', rows, options),
      insert: (rows: unknown[]) => write(table, 'insert', rows),
    }
    return query
  } } as unknown as SupabaseClient
  // Fallback requests can interleave; compare every request, not its completion order.
  const inventory = () => writes.map(row => JSON.stringify(row)).sort()
  return { client, inventory, maximum: () => maximum, active: () => active, snapshotRequests: () => snapshotRequests }
}

it.each<Mode>(['modern', 'metrics-missing', 'constraint-missing', 'both-missing'])('preserves every rating, snapshot and request payload across multiple batches (%s)', async mode => {
  const sequential = fixture(mode), paired = fixture(mode)
  const options = { now: Date.parse('2026-09-05T00:00:00Z'), replaceSnapshots: false }
  const expected = await recalculateDynamicRatings(undefined, sequential.client, options)
  const actual = await recalculateDynamicRatings(undefined, paired.client, { ...options, snapshotWriteConcurrency: 2 })
  expect(actual.processedMatchCount).toBe(180)
  expect(actual.snapshotCount).toBeGreaterThan(2000)
  expect(actual).toEqual(expected)
  expect(paired.inventory()).toEqual(sequential.inventory())
  expect(sequential.maximum()).toBe(1)
  expect(paired.maximum()).toBe(2)
  expect(paired.active()).toBe(0)
})

it('preserves the full rating and snapshot payload with four bounded writes', async () => {
  const sequential = fixture('modern'), parallel = fixture('modern')
  const options = { now: Date.parse('2026-09-05T00:00:00Z'), replaceSnapshots: false }
  const expected = await recalculateDynamicRatings(undefined, sequential.client, options)
  const actual = await recalculateDynamicRatings(undefined, parallel.client, { ...options, snapshotWriteConcurrency: 4 })
  expect(actual).toEqual(expected)
  expect(parallel.inventory()).toEqual(sequential.inventory())
  expect(parallel.maximum()).toBe(4)
  expect(parallel.active()).toBe(0)
})

it('performs no snapshot writes during a dry run even when paired writes are requested', async () => {
  const data = fixture('modern')
  const result = await recalculateDynamicRatings(undefined, data.client, { dryRun: true, snapshotWriteConcurrency: 2 })
  expect(result.processedMatchCount).toBe(180)
  expect(data.inventory()).toEqual([])
})

it('the actual engine rejects only after the sibling snapshot save settles, without reporting done', async () => {
  const data = fixture('modern', true), phases: string[] = []
  await expect(recalculateDynamicRatings(phase => phases.push(phase), data.client, {
    replaceSnapshots: false, snapshotWriteConcurrency: 2,
  })).rejects.toThrow('storage write failed')
  expect(data.active()).toBe(0)
  expect(data.snapshotRequests()).toBe(2)
  expect(phases.at(-1)).toBe('saving-snapshots')
  expect(phases).not.toContain('done')
})

it('drops snapshots for matches replaced while a long rating rebuild is running', async () => {
  const tables: Record<string, unknown[]> = {
    players: ['a', 'b'].map(id => ({ id, name: id, rating_source: 'verified', singles_rating: 4, doubles_rating: 4, overall_rating: 4 })),
    matches: [
      { id: 'kept', match_date: '2026-09-12', match_type: 'singles', score: '6-4 6-4', winner_side: 'A', rating_eligible: true },
      { id: 'replaced', match_date: '2026-09-13', match_type: 'singles', score: '6-3 6-3', winner_side: 'B', rating_eligible: true },
    ],
    match_players: ['kept', 'replaced'].flatMap(match_id => [
      { match_id, player_id: 'a', side: 'A', seat: 1 },
      { match_id, player_id: 'b', side: 'B', seat: 1 },
    ]),
  }
  const snapshotWrites: unknown[][] = []
  let snapshotAttempt = 0
  const client = { from(table: string) {
    const query = {
      select: () => query,
      not: () => query,
      eq: () => query,
      order: () => query,
      range: (start: number, end: number) => Promise.resolve({ data: (tables[table] || []).slice(start, end + 1), error: null }),
      in: (_column: string, ids: string[]) => Promise.resolve({
        data: table === 'matches' ? ids.filter(id => id === 'kept').map(id => ({ id })) : [],
        error: null,
      }),
      upsert: (rows: unknown[]) => {
        if (table !== 'rating_snapshots') return Promise.resolve({ error: null })
        snapshotWrites.push(rows)
        snapshotAttempt += 1
        return Promise.resolve(snapshotAttempt === 1
          ? { error: { message: 'insert or update on table "rating_snapshots" violates foreign key constraint "rating_snapshots_match_id_fkey"' } }
          : { error: null })
      },
    }
    return query
  } } as unknown as SupabaseClient

  const result = await recalculateDynamicRatings(undefined, client, { replaceSnapshots: false })

  expect(result.processedMatchCount).toBe(2)
  expect(snapshotWrites).toHaveLength(2)
  expect((snapshotWrites[1] as Array<{ match_id: string }>).every(row => row.match_id === 'kept')).toBe(true)
})
