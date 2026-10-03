import { expect, it } from 'vitest'
import type { RatingSnapshotInsert } from '../recalculateRatings'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createRatingSnapshotDiffPlanner, loadCurrentRatingSnapshots, planRatingSnapshotDiff } from '../rating-snapshot-diff'

const row = (match: string, change: Partial<RatingSnapshotInsert> = {}): RatingSnapshotInsert => ({ player_id: 'p', match_id: match, snapshot_date: '2026-06-01', rating_type: 'overall', track: 'tiq', dynamic_rating: 4.6, delta: 0.1, opponent_rating: 4.7, win_probability: 45, multiplier: null, ...change })
const stored = (match: string, change: Partial<RatingSnapshotInsert> = {}, id = match) => ({ ...row(match, change), id })

it('keeps identical rows and writes changes to every persisted value', () => {
  const changes: Partial<RatingSnapshotInsert>[] = [{ snapshot_date: '2026-06-02' }, { dynamic_rating: 4.61 }, { delta: 0.2 }, { opponent_rating: 4.8 }, { win_probability: 46 }, { multiplier: 1 }]
  const desired = [row('same'), row('new'), ...changes.map((change, i) => row(String(i), change))]
  const plan = planRatingSnapshotDiff(desired, [stored('same'), ...changes.map((_, i) => stored(String(i)))], 2026, new Set(['p']))
  expect(plan.unchanged).toBe(1)
  expect(plan.writes).toEqual(desired.slice(1))
  expect(plan.remove).toEqual([])
})

it('removes stale TIQ only for published players, preserving fallback, USTA and older history', () => {
  const old = [stored('stale'), stored('other', { player_id: 'fallback' }), stored('usta', { track: 'usta' }), stored('older', { snapshot_date: '2025-12-01' }), stored('future', { snapshot_date: '2027-01-01' })]
  expect(planRatingSnapshotDiff([], old, 2026, new Set(['p'])).remove).toEqual(['stale', 'future'])
})

it('distinguishes format and track keys and matches the result of full scoped replacement', () => {
  const desired = [row('court'), row('court', { track: 'usta' }), row('court', { rating_type: 'doubles' }), row('changed', { dynamic_rating: 4.8 })]
  const old = [stored('court'), stored('court', { track: 'usta' }, 'u'), stored('stale'), stored('changed'), stored('fallback', { player_id: 'fallback' }), stored('past', { snapshot_date: '2025-01-01' })]
  const plan = planRatingSnapshotDiff(desired, old, 2026, new Set(['p']))
  const identity = (r: RatingSnapshotInsert) => `${r.player_id}:${r.match_id}:${r.rating_type}:${r.track}`
  const actual = new Map(old.filter(r => !plan.remove.includes(r.id)).map(r => [identity(r), row(r.match_id, r)]))
  for (const r of plan.writes) actual.set(identity(r), r)
  const expected = new Map(old.filter(r => r.snapshot_date < '2026-01-01' || r.track !== 'tiq' || r.player_id !== 'p').map(r => [identity(r), row(r.match_id, r)]))
  for (const r of desired) expected.set(identity(r), r)
  const clean = (map: Map<string, RatingSnapshotInsert>) => [...map].map(([k,r]) => [k, { ...r, id: undefined }]).sort(([a], [b]) => String(a).localeCompare(String(b)))
  expect(clean(actual)).toEqual(clean(expected))
})

it('uses the final desired row per key and prunes duplicate managed records', () => {
  const plan = planRatingSnapshotDiff([row('m'), row('m', { dynamic_rating: 4.8 })], [stored('m'), stored('m', {}, 'duplicate')], 2026, new Set(['p']))
  expect(plan.writes).toEqual([row('m', { dynamic_rating: 4.8 })])
  expect(plan.remove).toEqual(['duplicate'])
})

it('ignores storage serialization noise but preserves meaningful changes and null values', () => {
  const plan = planRatingSnapshotDiff([row('noise', { dynamic_rating: 3.950953065288237 }), row('real', { dynamic_rating: 4.60000001 }), row('null', { multiplier: 0 })], [stored('noise', { dynamic_rating: 3.95095306528824 }), stored('real'), stored('null')], 2026, new Set(['p']))
  expect(plan.unchanged).toBe(1)
  expect(plan.writes.map(r => r.match_id)).toEqual(['real', 'null'])
})

it('reads four disjoint indexed ranges completely, including a second page and future history', async () => {
  const uuid = (prefix: string, i: number) => `${prefix}-0000-0000-0000-${String(i).padStart(12, '0')}`
  const rows = [...Array.from({ length: 1001 }, (_, i) => stored(String(i), {}, uuid('00000000', i))), ...['40000000','80000000','c0000000'].map(prefix => stored(prefix, { snapshot_date: '2027-01-01' }, uuid(prefix, 0))), stored('old', { snapshot_date: '2025-01-01' }, uuid('00000000', 1002))]
  const calls: Array<{ lower: string; upper?: string; cursor?: string }> = []
  let active = 0, maximum = 0
  const client = { from() {
    let lower = '', upper: string | undefined, cursor: string | undefined, date = ''
    const query = {
      select: () => query, order: () => query, limit: () => query,
      gte: (column: string, value: string) => { if (column === 'id') lower = value; else date = value; return query },
      lt: (_column: string, value: string) => { upper = value; return query },
      gt: (_column: string, value: string) => { cursor = value; return query },
      then: (resolve: (result: unknown) => unknown) => {
        calls.push({ lower, upper, cursor }); active++; maximum = Math.max(maximum, active)
        return new Promise(done => setTimeout(() => { active--; done({ data: rows.filter(r => r.id >= lower && (!upper || r.id < upper) && (!cursor || r.id > cursor) && r.snapshot_date >= date).slice(0, 1000), error: null }) }, 1)).then(resolve)
      },
    }
    return query
  } } as unknown as SupabaseClient
  const found = await loadCurrentRatingSnapshots(client, 2026)
  expect(found).toHaveLength(1004)
  expect(new Set(found.map(r => r.id)).size).toBe(1004)
  expect(calls).toHaveLength(5)
  expect(calls.some(c => c.cursor === uuid('00000000', 999))).toBe(true)
  expect(maximum).toBe(4)
  expect(active).toBe(0)
})

it('streamed planning matches full replacement across pages without retaining unchanged rows', () => {
  const desired = [row('same'), row('changed', { dynamic_rating: 4.8 }), row('new'), row('duplicate')]
  const old = [stored('same'), stored('changed'), stored('stale'), stored('fallback', { player_id: 'other' }), stored('duplicate'), stored('duplicate', {}, 'extra')]
  const planner = createRatingSnapshotDiffPlanner(desired, 2026, new Set(['p']))
  planner.consume(old.slice(0, 3)); planner.consume(old.slice(3))
  const actual = planner.finish(), expected = planRatingSnapshotDiff(desired, old, 2026, new Set(['p']))
  expect(actual.writes).toEqual(expected.writes)
  expect(actual.remove).toEqual(expected.remove)
  expect(actual.unchanged).toBe(expected.unchanged)
  expect(actual.existingRows.map(r => r.id)).toEqual(['changed'])
  expect(actual.existing).toBe(6)
})
