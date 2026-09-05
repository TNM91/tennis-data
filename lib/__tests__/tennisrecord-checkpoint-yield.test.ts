import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTennisRecordSync } from '../tennisrecord/service'
import { fetchTennisRecordPage, TennisRecordCheckpointBudgetError } from '../tennisrecord/collector'

vi.mock('../tennisrecord/collector', async importOriginal => ({
  ...await importOriginal<typeof import('../tennisrecord/collector')>(),
  fetchTennisRecordPage: vi.fn(),
}))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

function fixture(options: { failRelease?: boolean; expireDuringSelection?: boolean } = {}) {
  const writes: Array<{ table: string; action: string; payload: Record<string, unknown> }> = []
  let selections = 0
  const db = { from(table: string) {
    let action = 'select'; let columns = ''; let payload: Record<string, unknown> = {}
    const result = () => {
      if (action !== 'select') {
        writes.push({ table, action, payload })
        if (options.failRelease && table === 'tennisrecord_crawl_queue' && payload.status === 'pending') return { data: null, error: { message: 'Release failed' } }
        return { data: action === 'insert' && table === 'tennisrecord_sync_runs' ? { id: 'run-1' } : [], error: null }
      }
      if (table === 'tennisrecord_collector_settings') return { data: { enabled: true, min_request_interval_ms: 1000, max_requests_per_run: 18 }, error: null }
      if (table === 'tennisrecord_crawl_queue' && columns.startsWith('id,source_url,page_kind')) {
        selections++
        if (options.expireDuringSelection) vi.setSystemTime(Date.now() + 180_000)
        return { data: selections === 1 ? { id: 'page-1', source_url: 'https://www.tennisrecord.com/adult/profile.aspx?playername=Example', page_kind: 'player', retry_count: 2 } : null, error: null }
      }
      return { data: [], error: null }
    }
    const query: object = new Proxy({}, { get(_target, key) {
      if (key === 'then') return (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject)
      return (...args: unknown[]) => {
        if (key === 'insert' || key === 'update' || key === 'upsert') { action = String(key); payload = args[0] as Record<string, unknown> }
        if (key === 'select') columns = String(args[0] || '')
        return query
      }
    } })
    return query
  } } as unknown as SupabaseClient
  return { db, writes, selections: () => selections }
}

describe('checkpoint yield persistence', () => {
  it('returns a claimed page to pending and completes the run without using another retry', async () => {
    vi.mocked(fetchTennisRecordPage).mockRejectedValue(new TennisRecordCheckpointBudgetError())
    const { db, writes, selections } = fixture()
    const summary = await runTennisRecordSync(db, { triggerKind: 'bootstrap', recalculateRatings: false })
    expect(summary).toMatchObject({ status: 'completed', pagesAttempted: 1, pagesProcessed: 0, transientRetries: 0, sourceFailures: 0 })
    expect(writes.filter(w => w.table === 'tennisrecord_crawl_queue').map(w => w.payload.status)).toEqual(['running', 'pending'])
    expect(writes.filter(w => w.table === 'tennisrecord_crawl_queue').every(w => !('retry_count' in w.payload))).toBe(true)
    expect(writes.at(-1)).toMatchObject({ table: 'tennisrecord_sync_runs', payload: { status: 'completed' } })
    expect(selections()).toBe(1)
  })

  it('reports a failed checkpoint if its page could not be released', async () => {
    vi.mocked(fetchTennisRecordPage).mockRejectedValue(new TennisRecordCheckpointBudgetError())
    const { db, writes } = fixture({ failRelease: true })
    await expect(runTennisRecordSync(db, { triggerKind: 'bootstrap', recalculateRatings: false })).rejects.toThrow('Release failed')
    expect(writes.at(-1)).toMatchObject({ table: 'tennisrecord_sync_runs', payload: { status: 'failed', error_message: 'Release failed' } })
  })

  it('does not claim a page when selection itself consumes the remaining time', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T08:00:00Z'))
    const { db, writes } = fixture({ expireDuringSelection: true })
    const summary = await runTennisRecordSync(db, { triggerKind: 'bootstrap', recalculateRatings: false })
    expect(summary).toMatchObject({ status: 'completed', pagesAttempted: 0 })
    expect(writes.filter(w => w.table === 'tennisrecord_crawl_queue')).toEqual([])
    expect(fetchTennisRecordPage).not.toHaveBeenCalled()
  })
})
