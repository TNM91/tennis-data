import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
vi.mock('@/lib/recalculateRatings', () => ({ recalculateDynamicRatings: vi.fn() }))
import { recalculateDynamicRatings } from '../recalculateRatings'
import { prepareCurrentSeasonRefresh, runScheduledTennisRecordRatingBatch } from '../tennisrecord/service'

type Call = { table: string; ops: { name: string; args: unknown[] }[] }
type Result = { data?: unknown; error?: { code?: string; message: string } | null; count?: number }
function fakeDb(respond: (call: Call) => Result) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    const query: object = new Proxy({}, { get: (_, name: string) => {
      if (name === 'then') return (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => {
        calls.push(call)
        return Promise.resolve(respond(call)).then(resolve, reject)
      }
      return (...args: unknown[]) => { call.ops.push({ name, args }); return query }
    } })
    return query
  }
  const rpc = async (name: string, args: unknown) => {
    const call = { table: name, ops: [{ name: 'rpc', args: [args] }] }
    calls.push(call); return respond(call)
  }
  return { db: { from, rpc } as unknown as SupabaseClient, calls }
}
const op = (call: Call, name: string) => call.ops.find(o => o.name === name)
const settings: Parameters<typeof prepareCurrentSeasonRefresh>[2] = {
  enabled: true, current_refresh_enabled: true, current_refresh_seeded_at: null,
  min_request_interval_ms: 3000, max_requests_per_run: 18, weekly_lookback_days: 7,
  automation_state: 'bootstrap', bootstrap_started_at: null, bootstrap_completed_at: null,
  weekly_refresh_started_at: null, active_campaign_id: 'mo', rating_recalculation_requested_at: null,
  rating_recalculation_reason: null, rating_recalculated_at: null,
}
beforeEach(() => vi.clearAllMocks())

describe('current refresh preparation', () => {
  it('paginates every known MO profile and bounds URL batches before advancing the seed watermark', async () => {
    let pages = 0
    const { db, calls } = fakeDb(call => {
      if (call.table === 'tennisrecord_campaigns') return { data: { id: 'mo', slug: 'missouri-2025-current' } }
      if (call.table === 'tennisrecord_staged_players') {
        pages++
        return { data: Array.from({ length: pages === 1 ? 500 : 1 }, (_, i) => ({ id: String((pages - 1) * 500 + i).padStart(5, '0'), name: 'Fixture ' + ((pages - 1) * 500 + i) })) }
      }
      return { data: [], error: null }
    })
    await prepareCurrentSeasonRefresh(db, 'run', settings)
    expect(calls.filter(c => c.table === 'tennisrecord_staged_players')).toHaveLength(1)
    expect(calls.find(c => c.table === 'prepare_tennisrecord_current_refresh')?.ops[0].args).toEqual([{ p_run_id: 'run', p_seed: false }])
    await prepareCurrentSeasonRefresh(db, 'next-run', { ...settings, current_refresh_player_cursor: '00499', current_refresh_seed_cycle_at: new Date().toISOString() })
    const profileCalls = calls.filter(c => c.table === 'tennisrecord_staged_players')
    expect(profileCalls).toHaveLength(2)
    expect(op(profileCalls[1], 'gt')?.args).toEqual(['id', '00499'])
    expect(profileCalls.every(c => c.ops.some(o => o.name === 'eq' && o.args[0] === 'state' && o.args[1] === 'MO'))).toBe(true)
    const batches = calls.filter(c => c.table === 'tennisrecord_crawl_queue' && op(c, 'upsert')).map(c => op(c, 'upsert')!.args[0] as { source_url: string }[])
    expect(batches.every(b => b.length <= 50)).toBe(true)
    expect(batches.flat().filter(r => r.source_url.includes('Fixture'))).toHaveLength(501)
    expect(calls.findLastIndex(c => c.table === 'prepare_tennisrecord_current_refresh')).toBeGreaterThan(calls.findLastIndex(c => c.table === 'tennisrecord_staged_players'))
  })

  it('does not acknowledge a seed when a later profile page fails', async () => {
    let pages = 0
    const { db, calls } = fakeDb(call => {
      if (call.table === 'tennisrecord_campaigns') return { data: { id: 'mo', slug: 'missouri-2025-current' } }
      if (call.table === 'tennisrecord_staged_players') return ++pages === 1
        ? { data: Array.from({ length: 500 }, (_, i) => ({ id: String(i), name: 'Fixture ' + i })) }
        : { error: { message: 'read failed' } }
      return { data: [], error: null }
    })
    await prepareCurrentSeasonRefresh(db, 'run', settings)
    await expect(prepareCurrentSeasonRefresh(db, 'next-run', { ...settings, current_refresh_player_cursor: '499', current_refresh_seed_cycle_at: new Date().toISOString() })).rejects.toThrow('read failed')
    expect(calls.filter(c => c.table === 'prepare_tennisrecord_current_refresh')).toHaveLength(1)
  })

  it('continues due-page release without rebuilding the seed list every checkpoint', async () => {
    const { db, calls } = fakeDb(() => ({ data: [], error: null }))
    await prepareCurrentSeasonRefresh(db, 'run', { ...settings, current_refresh_seeded_at: new Date().toISOString() })
    expect(calls.some(c => c.table === 'tennisrecord_staged_players')).toBe(false)
    expect(calls[0].ops[0].args).toEqual([{ p_run_id: 'run', p_seed: false }])
  })
})

describe('rating/import mutual exclusion', () => {
  function ratingDb(lockFails = false) {
    return fakeDb(call => {
      if (call.table === 'tennisrecord_collector_settings') return { data: { ...settings, automation_state: 'weekly' } }
      if (call.table === 'tennisrecord_sync_runs' && op(call, 'insert')) return lockFails
        ? { error: { code: '23505', message: 'tennisrecord_sync_runs_one_active_idx' } }
        : { data: { id: 'rating-run' } }
      if (call.table === 'tennisrecord_sync_runs') return { data: null, error: null }
      return { data: [{ fingerprint: 'f1' }], count: 1, error: null }
    })
  }
  it('does not rebuild when an import wins the atomic lock race', async () => {
    const { db } = ratingDb(true)
    expect((await runScheduledTennisRecordRatingBatch(db)).status).toBe('skipped')
    expect(recalculateDynamicRatings).not.toHaveBeenCalled()
  })
  it('releases the lock on failure without clearing queued evidence', async () => {
    vi.mocked(recalculateDynamicRatings).mockRejectedValueOnce(new Error('save failed'))
    const { db, calls } = ratingDb()
    await expect(runScheduledTennisRecordRatingBatch(db)).rejects.toThrow('save failed')
    expect(calls.some(c => c.table === 'tennisrecord_collector_settings' && op(c, 'update'))).toBe(false)
    expect(op(calls.at(-1)!, 'update')?.args[0]).toMatchObject({ status: 'failed' })
  })
  it('keeps newer requests queued and completes the shared lock after success', async () => {
    vi.mocked(recalculateDynamicRatings).mockResolvedValueOnce({} as Awaited<ReturnType<typeof recalculateDynamicRatings>>)
    const { db, calls } = ratingDb()
    expect((await runScheduledTennisRecordRatingBatch(db)).status).toBe('completed')
    const clear = calls.find(c => c.table === 'tennisrecord_collector_settings' && c.ops.some(o => o.name === 'lte'))!
    expect(op(clear, 'lte')?.args[0]).toBe('rating_recalculation_requested_at')
    expect(op(calls.at(-1)!, 'update')?.args[0]).toMatchObject({ status: 'completed' })
  })
})
