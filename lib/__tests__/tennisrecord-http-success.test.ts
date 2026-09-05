import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTennisRecordPage } from '../tennisrecord/collector'
import { parseTennisRecordMatchPage } from '../tennisrecord/parser'
import { isSuccessfulTennisRecordHttpStatus, runAutomaticTennisRecordSync, runScheduledTennisRecordSync, runTennisRecordSync, tennisRecordCadenceSafetyStatus, tennisRecordDeferredRetryAt, tennisRecordFailureDisposition, tennisRecordPipelineHealth, tennisRecordTransientRetryAt } from '../tennisrecord/service'

vi.mock('../tennisrecord/collector', async original => ({
  ...await original<typeof import('../tennisrecord/collector')>(), fetchTennisRecordPage: vi.fn(),
}))
vi.mock('../tennisrecord/parser', async original => ({
  ...await original<typeof import('../tennisrecord/parser')>(), parseTennisRecordMatchPage: vi.fn(),
}))

const now = Date.parse('2026-09-05T17:00:00Z')
const url = 'https://www.tennisrecord.com/adult/profile.aspx?playername=Fixture'
type Row = Record<string, unknown>
type Op = { name: string; args: unknown[] }
type Call = { table: string; ops: Op[] }
const op = (call: Call, name: string) => call.ops.find(o => o.name === name)

function fixture(options: { kind?: string; retryCount?: number; deferredCount?: number; replay?: Row[]; failSave?: boolean; outage?: Row; lockedOutage?: Row; jobCount?: number; failOutageSave?: boolean; failCapture?: boolean; staleRun?: boolean } = {}) {
  const calls: Call[] = []
  let selections = 0
  let outage = options.outage || {}
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    const result = () => {
      calls.push(call)
      const update = op(call, 'update')?.args[0] as Row | undefined
      if (table === 'tennisrecord_collector_settings' && update?.source_outage_state) {
        if (options.failOutageSave) return { error: { message: 'Cooldown save failed' } }
        outage = update.source_outage_state as Row
      }
      if (options.failCapture && table === 'tennisrecord_source_pages' && op(call, 'upsert')) return { error: { message: 'Database network timeout' } }
      if (options.failSave && table === 'tennisrecord_crawl_queue' && update?.failure_reason) return { error: { message: 'Retry save failed' } }
      if (op(call, 'insert') || op(call, 'upsert') || update) return { data: { id: 'saved-evidence' }, error: null }
      if (options.staleRun && table === 'tennisrecord_sync_runs' && op(call, 'lt')) return { data: [{ id: 'stale-run' }], error: null }
      if (table === 'tennisrecord_collector_settings') return { data: { automation_state: 'bootstrap', source_outage_state: op(call, 'select')?.args[0] === 'source_outage_state' ? options.lockedOutage || outage : outage, enabled: true, current_refresh_enabled: true, current_refresh_seeded_at: new Date(now).toISOString(), min_request_interval_ms: 3000, max_requests_per_run: options.jobCount || 1 } }
      if (table === 'tennisrecord_crawl_queue' && String(op(call, 'select')?.args[0]).startsWith('id,source_url,page_kind')) return { data: ++selections <= (options.jobCount || 1) && !options.replay ? { id: `queue-${selections}`, source_url: url, page_kind: options.kind || 'player', retry_count: options.retryCount || 0, deferred_retry_count: options.deferredCount || 0 } : null }
      if (table === 'tennisrecord_source_pages') return { data: options.replay || [] }
      return { data: [], error: null }
    }
    const query: object = new Proxy({}, { get: (_, key: string) => key === 'then'
      ? (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject)
      : (...args: unknown[]) => { call.ops.push({ name: key, args }); return query },
    })
    return query
  }
  const upload = vi.fn().mockResolvedValue({ error: null })
  const download = vi.fn()
  const db = { from, rpc: vi.fn().mockResolvedValue({ data: [], error: null }), storage: { from: () => ({ upload, download }) } } as unknown as SupabaseClient
  return { db, calls, upload, download, queueWrites: () => calls.filter(c => c.table === 'tennisrecord_crawl_queue' && op(c, 'update')).map(c => op(c, 'update')!.args[0] as Row) }
}

function response(status: number, blockReason = '') {
  vi.useFakeTimers(); vi.setSystemTime(now)
  vi.mocked(fetchTennisRecordPage).mockResolvedValue({ url, status, html: 'The service is unavailable.', blockReason, contentHash: 'hash', transientRetries: 0 })
  vi.mocked(parseTennisRecordMatchPage).mockReturnValue({ players: [], teams: [], leagues: [], teamMembers: [], matches: [], discoveredUrls: [] })
}
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })

describe('HTTP success is required for import completion', () => {
  it('still reclaims stale locks during cooldown so ratings are not stranded', async () => {
    response(200)
    const f = fixture({ staleRun: true, outage: { cooldownUntil: '2026-09-05T17:15:00Z', level: 1 } })
    expect(await runAutomaticTennisRecordSync(f.db)).toMatchObject({ reason: 'source_cooldown' })
    expect(fetchTennisRecordPage).not.toHaveBeenCalled()
    expect(f.queueWrites()).toHaveLength(1)
    expect(f.queueWrites()[0]).toMatchObject({ status: 'pending' })
    expect(f.queueWrites()[0]).not.toHaveProperty('retry_count')
    expect(f.calls.some(c => c.table === 'tennisrecord_sync_runs' && (op(c, 'update')?.args[0] as Row)?.status === 'failed')).toBe(true)
  })

  it('skips scheduler preparation and reports a clear operational status during cooldown', async () => {
    response(200)
    const outage = { cooldownUntil: '2026-09-05T17:15:00Z', level: 1 }
    for (const run of [runAutomaticTennisRecordSync, (db: SupabaseClient) => runScheduledTennisRecordSync(db, 'bootstrap'), (db: SupabaseClient) => runScheduledTennisRecordSync(db, 'weekly')]) {
      const f = fixture({ outage })
      expect(await run(f.db)).toMatchObject({ status: 'skipped', reason: 'source_cooldown' })
      expect(f.calls.some(c => op(c, 'insert') || op(c, 'update') || op(c, 'upsert'))).toBe(false)
    }
    expect(tennisRecordPipelineHealth({ enabled: true, automationState: 'bootstrap', lastSuccessfulCollectorAt: null, safetyThrottle: tennisRecordCadenceSafetyStatus(null, now), sourceOutage: outage }, now)).toMatchObject({ state: 'cooling_down', message: expect.stringContaining('retry automatically') })
  })

  it.each(['weekly', 'bootstrap', 'manual'] as const)('skips %s during a shared pause without claiming or retrying anything', async triggerKind => {
    response(200)
    const f = fixture({ outage: { cooldownUntil: '2026-09-05T17:15:00Z', level: 1 } })
    expect(await runTennisRecordSync(f.db, { triggerKind })).toMatchObject({ status: 'skipped', reason: 'source_cooldown', pagesAttempted: 0 })
    expect(fetchTennisRecordPage).not.toHaveBeenCalled()
    expect(f.queueWrites()).toHaveLength(0)
    expect(f.calls.some(c => op(c, 'insert') || op(c, 'update') || op(c, 'upsert'))).toBe(false)
  })

  it('rechecks the pause after acquiring the shared lock', async () => {
    response(200)
    const f = fixture({ lockedOutage: { cooldownUntil: '2026-09-05T17:15:00Z', level: 1 } })
    expect(await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true })).toMatchObject({ reason: 'source_cooldown' })
    expect(fetchTennisRecordPage).not.toHaveBeenCalled()
    expect(f.db.rpc).not.toHaveBeenCalled()
    expect(f.queueWrites()).toHaveLength(0)
  })

  it.each(['http', 'transport'])('stops after three distinct %s failures and preserves the triggering page retry allowance', async kind => {
    response(503)
    if (kind === 'transport') vi.mocked(fetchTennisRecordPage).mockRejectedValue(new TypeError('fetch failed'))
    const f = fixture({ jobCount: 8 })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true, recalculateRatings: false })
    expect(summary).toMatchObject({ pagesAttempted: 3, pagesProcessed: 0, reason: 'source_cooldown', retryAt: '2026-09-05T17:15:00.000Z' })
    expect(fetchTennisRecordPage).toHaveBeenCalledTimes(3)
    expect(f.queueWrites().at(-1)).toMatchObject({ status: 'pending', deferred_retry_at: summary.retryAt })
    expect(f.queueWrites().at(-1)).not.toHaveProperty('retry_count')
    expect(f.queueWrites().at(-1)).not.toHaveProperty('completed_at')
  })

  it('extends an expired pause on the first failed probe without burning retries', async () => {
    response(503)
    const f = fixture({ jobCount: 8, retryCount: 3, deferredCount: 2, outage: { level: 1, cooldownUntil: '2026-09-05T16:59:00Z' } })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'bootstrap', recalculateRatings: false })
    expect(summary).toMatchObject({ pagesAttempted: 1, reason: 'source_cooldown', retryAt: '2026-09-05T17:30:00.000Z' })
    expect(f.queueWrites().at(-1)).not.toHaveProperty('retry_count')
    expect(f.queueWrites().at(-1)).not.toHaveProperty('deferred_retry_count')
  })

  it('clears an expired pause after a real response and resumes normal imports', async () => {
    response(200)
    const f = fixture({ jobCount: 2, outage: { level: 2, cooldownUntil: '2026-09-05T16:59:00Z' } })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true, recalculateRatings: false })
    expect(summary).toMatchObject({ pagesAttempted: 2, pagesProcessed: 2 })
    expect(f.calls.some(c => (op(c, 'update')?.args[0] as Row)?.source_outage_state && ((op(c, 'update')!.args[0] as Row).source_outage_state as Row).level === 0)).toBe(true)
  })

  it('never opens a source cooldown for a database timeout', async () => {
    response(200)
    const f = fixture({ jobCount: 4, failCapture: true })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true, recalculateRatings: false })
    expect(summary.reason).toBeUndefined()
    expect(f.calls.some(c => (op(c, 'update')?.args[0] as Row)?.source_outage_state)).toBe(false)
  })

  it('fails visibly and stops requests if cooldown persistence fails', async () => {
    response(503)
    const f = fixture({ jobCount: 4, failOutageSave: true })
    await expect(runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true })).rejects.toThrow('Cooldown save failed')
    expect(fetchTennisRecordPage).toHaveBeenCalledTimes(1)
    expect(f.queueWrites().at(-1)).toEqual({ status: 'pending' })
  })

  it('also stops if persisting recovery fails, without burning a page retry', async () => {
    response(200)
    const f = fixture({ jobCount: 4, failOutageSave: true, outage: { level: 1, cooldownUntil: '2026-09-05T16:59:00Z' } })
    await expect(runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true })).rejects.toThrow('Cooldown save failed')
    expect(fetchTennisRecordPage).toHaveBeenCalledTimes(1)
    expect(f.queueWrites().some(w => 'retry_count' in w)).toBe(false)
  })

  it('a successful response between failures resets the distinct-page streak', async () => {
    response(503)
    const failure = new TypeError('fetch failed')
    const good = await vi.mocked(fetchTennisRecordPage).getMockImplementation()!(url, 3000)
    vi.mocked(fetchTennisRecordPage).mockReset().mockRejectedValueOnce(failure).mockRejectedValueOnce(failure).mockResolvedValueOnce({ ...good, status: 200 }).mockRejectedValueOnce(failure).mockRejectedValueOnce(failure)
    const f = fixture({ jobCount: 5 })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true, recalculateRatings: false })
    expect(summary.reason).toBeUndefined()
    expect(summary.pagesAttempted).toBe(5)
    expect(summary.pagesProcessed).toBe(1)
  })

  it('cached replay alone does not clear an expired source outage', async () => {
    response(200)
    const f = fixture({ outage: { level: 2, cooldownUntil: '2026-09-05T16:59:00Z' }, replay: [{ id: 'cached', source_url: url, http_status: 200, raw_html: '<main>Cached</main>' }] })
    await runTennisRecordSync(f.db, { triggerKind: 'bootstrap', recalculateRatings: false })
    expect(fetchTennisRecordPage).not.toHaveBeenCalled()
    expect(f.calls.some(c => (op(c, 'update')?.args[0] as Row)?.source_outage_state)).toBe(false)
  })

  it('stops the checkpoint on an access block, without turning it into an outage retry', async () => {
    response(503, 'access denied')
    const f = fixture({ jobCount: 4 })
    expect(await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true })).toMatchObject({ status: 'blocked', pagesAttempted: 1 })
    expect(f.queueWrites().at(-1)).toMatchObject({ status: 'blocked' })
    expect(f.queueWrites().at(-1)).not.toHaveProperty('deferred_retry_at')
  })

  it.each(['player', 'history', 'team', 'league', 'match'])('retains a 503 %s page without parsing, staging or marking it refreshed', async kind => {
    response(503)
    const f = fixture({ kind })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true, recalculateRatings: false })
    expect(summary).toMatchObject({ pagesAttempted: 1, pagesProcessed: 0, matchesStaged: 0, transientRetries: 1, parserFailures: 0 })
    expect(f.upload).toHaveBeenCalledTimes(1)
    expect(f.calls.some(c => c.table === 'tennisrecord_source_pages' && (op(c, 'upsert')?.args[0] as Row)?.http_status === 503)).toBe(true)
    expect(parseTennisRecordMatchPage).not.toHaveBeenCalled()
    expect(f.calls.some(c => /staged_|^matches$|^players$/.test(c.table))).toBe(false)
    expect(f.queueWrites().at(-1)).toMatchObject({ status: 'pending', retry_count: 1, deferred_retry_at: '2026-09-05T17:06:00.000Z', failure_reason: expect.stringContaining('HTTP 503') })
    expect(f.queueWrites().some(w => 'current_refreshed_at' in w || 'refresh_due_at' in w || 'completed_at' in w)).toBe(false)
    expect(fetchTennisRecordPage).toHaveBeenCalledTimes(1)
  })

  it.each([301, 404, 410, 501])('leaves permanent HTTP %i errors visible without automatic retries', async status => {
    response(status)
    const f = fixture()
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'bootstrap', recalculateRatings: false })
    expect(summary).toMatchObject({ pagesProcessed: 0, sourceFailures: 1, transientRetries: 0 })
    expect(f.queueWrites().at(-1)).toMatchObject({ status: 'error', deferred_retry_at: null })
    expect(parseTennisRecordMatchPage).not.toHaveBeenCalled()
  })

  it.each([401, 403, 407, 429, 503])('keeps HTTP %i access blocks terminal even for a transient server status', async status => {
    response(status, 'access denied')
    const f = fixture()
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'bootstrap', recalculateRatings: false })
    expect(summary).toMatchObject({ status: 'blocked', blockedRequests: 1, transientRetries: 0, pagesProcessed: 0 })
    expect(f.queueWrites().at(-1)?.status).toBe('blocked')
    expect(parseTennisRecordMatchPage).not.toHaveBeenCalled()
  })

  it('stops retrying a persistent service failure after the existing bounded budget', async () => {
    response(503)
    const f = fixture({ retryCount: 3, deferredCount: 2 })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'bootstrap', recalculateRatings: false })
    expect(summary.sourceFailures).toBe(1)
    expect(f.queueWrites().at(-1)).toMatchObject({ status: 'error', retry_count: 3, deferred_retry_at: null })
  })

  it('fails the run visibly if saving its retry fails', async () => {
    response(503)
    const f = fixture({ failSave: true })
    await expect(runTennisRecordSync(f.db, { triggerKind: 'bootstrap', recalculateRatings: false })).rejects.toThrow('Retry save failed')
  })

  it('still completes a successfully fetched discovery page and advances current freshness', async () => {
    response(200)
    const f = fixture()
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true, recalculateRatings: false })
    expect(parseTennisRecordMatchPage).toHaveBeenCalledTimes(1)
    expect(summary.pagesProcessed).toBe(1)
    expect(f.queueWrites().at(-1)).toMatchObject({ status: 'done', current_refreshed_at: new Date(now).toISOString(), refresh_due_at: '2026-09-12T17:00:00.000Z' })
  })

  it('retains parser review for a successful HTTP match page without complete results', async () => {
    response(200)
    const f = fixture({ kind: 'match' })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'weekly', currentSeason: true, recalculateRatings: false })
    expect(summary.parserFailures).toBe(1)
    expect(f.queueWrites().at(-1)?.status).toBe('review')
  })

  it('filters replay candidates before its limit and never downloads or supersedes error evidence', async () => {
    response(200)
    const f = fixture({ replay: [503, 404, null, 200].map((status, i) => ({ id: String(i), source_url: url, http_status: status, raw_html: status === 200 ? '<main>Valid page</main>' : null, raw_html_storage_path: 'error-evidence' })) })
    const summary = await runTennisRecordSync(f.db, { triggerKind: 'bootstrap', recalculateRatings: false })
    const read = f.calls.find(c => c.table === 'tennisrecord_source_pages' && !op(c, 'upsert') && !op(c, 'update'))!
    expect(read.ops).toContainEqual({ name: 'gte', args: ['http_status', 200] })
    expect(read.ops).toContainEqual({ name: 'lt', args: ['http_status', 300] })
    expect(read.ops.findIndex(o => o.name === 'gte')).toBeLessThan(read.ops.findIndex(o => o.name === 'limit'))
    expect(f.download).not.toHaveBeenCalled()
    expect(parseTennisRecordMatchPage).toHaveBeenCalledExactlyOnceWith('<main>Valid page</main>', url)
    expect(summary.pagesProcessed).toBe(1)
    expect(f.calls.filter(c => c.table === 'tennisrecord_staged_matches' && op(c, 'update'))).toHaveLength(1)
  })

  it('accepts only known integer 2xx statuses and retries only designated transient HTTP errors', () => {
    for (const status of [200, 204, 299]) expect(isSuccessfulTennisRecordHttpStatus(status)).toBe(true)
    for (const status of [null, undefined, '200', 0, 199, 300, 503, 200.5, NaN]) expect(isSuccessfulTennisRecordHttpStatus(status)).toBe(false)
    for (const status of [408, 500, 502, 503, 504]) {
      const message = `TennisRecord source HTTP ${status}; response retained, import not completed.`
      expect(tennisRecordFailureDisposition(message, 0)).toBe('retry')
      expect(tennisRecordTransientRetryAt(message, 0, now)).toBe('2026-09-05T17:06:00.000Z')
      expect(tennisRecordDeferredRetryAt(message, 0, now)).not.toBeNull()
      expect(tennisRecordDeferredRetryAt(message, 2, now)).toBeNull()
    }
    expect(tennisRecordFailureDisposition('TennisRecord source HTTP 404; network timeout', 0)).toBe('quarantine')
  })
})
