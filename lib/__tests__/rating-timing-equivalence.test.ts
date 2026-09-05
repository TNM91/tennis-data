import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, it, vi } from 'vitest'
import { recalculateDynamicRatings, type RecalcPhase } from '../recalculateRatings'
import { createRatingTimingObserver } from '../tennisrecord/telemetry'

function fixture(onCalculation = () => {}) {
  const tables: Record<string, unknown[]> = {
    players: ['a', 'b', 'c', 'd'].map(id => ({ id, name: 'Fixture', rating_source: 'verified', singles_rating: 4, doubles_rating: 4, overall_rating: 4 })),
    matches: [
      { id: 's', match_date: '2026-09-03', match_type: 'singles', score: '6-4 3-6 1-0', get winner_side() { onCalculation(); return 'B' }, rating_eligible: true },
      { id: 'd', match_date: '2026-09-04', match_type: 'doubles', score: '6-3 6-2', get winner_side() { onCalculation(); return 'A' }, rating_eligible: true },
    ],
    match_players: [
      { match_id: 's', player_id: 'a', side: 'A', seat: 1 }, { match_id: 's', player_id: 'b', side: 'B', seat: 1 },
      ...['a', 'b', 'c', 'd'].map((id, i) => ({ match_id: 'd', player_id: id, side: i < 2 ? 'A' : 'B', seat: i % 2 + 1 })),
    ],
  }
  const writes: Array<{ table: string; rows: unknown }> = []
  const client = { from(table: string) {
    const query = {
      select: () => query, not: () => query, eq: () => query, order: () => query,
      range: (start: number, end: number) => Promise.resolve({ data: (tables[table] || []).slice(start, end + 1), error: null }),
      upsert: (rows: unknown) => { writes.push({ table, rows }); return Promise.resolve({ error: null }) },
    }
    return query
  } } as unknown as SupabaseClient
  return { client, writes }
}

it('timing leaves every derived rating, snapshot and persistence payload unchanged', async () => {
  const options = { now: Date.parse('2026-09-05T00:00:00Z'), replaceSnapshots: false }
  const plain = fixture()
  const expected = await recalculateDynamicRatings(undefined, plain.client, options)
  let phase: RecalcPhase | undefined
  const measured = fixture(() => expect(phase).toBe('processing'))
  const emit = vi.fn()
  const timer = createRatingTimingObserver('fixture-run', undefined, emit)
  const result = await recalculateDynamicRatings(next => { phase = next; timer.onPhase(next) }, measured.client, options)
  timer.finish('completed')
  expect(result.processedMatchCount).toBe(2)
  expect(result).toEqual(expected)
  expect(measured.writes).toEqual(plain.writes)
  expect(emit.mock.calls.map(([e]) => e.phase)).toContain('saving-snapshots')
})
