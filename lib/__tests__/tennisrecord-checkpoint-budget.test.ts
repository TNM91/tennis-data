import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTennisRecordPage, hasTennisRecordFetchBudget, TennisRecordCheckpointBudgetError, TENNISRECORD_SOURCE_WORK_BUDGET_MS } from '../tennisrecord/collector'

const url = 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=1'
const start = Date.parse('2026-09-05T08:00:00Z')
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('bounded TennisRecord checkpoints', () => {
  it('reserves two minutes for database work without increasing source request rates', () => {
    expect(TENNISRECORD_SOURCE_WORK_BUDGET_MS).toBe(180_000)
    expect(hasTennisRecordFetchBudget(start + 1000, 1, start)).toBe(false)
    expect(hasTennisRecordFetchBudget(start + 1001, 1, start)).toBe(true)
    expect(hasTennisRecordFetchBudget(start + 5000, 5000, start)).toBe(false)
    expect(hasTennisRecordFetchBudget(Number.NaN, 1000, start)).toBe(false)
    expect(hasTennisRecordFetchBudget(undefined, 1000, start)).toBe(true)
  })

  it('does not fetch or wait when the checkpoint cannot fit the pacing interval', async () => {
    vi.useFakeTimers(); vi.setSystemTime(start)
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(fetchTennisRecordPage(url, 5000, start + 4000)).rejects.toBeInstanceOf(TennisRecordCheckpointBudgetError)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds the request and body timeout to the remaining checkpoint time', async () => {
    vi.useFakeTimers(); vi.setSystemTime(start)
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal)
    const fetchMock = vi.fn().mockResolvedValue(new Response('<main>Match</main>'))
    vi.stubGlobal('fetch', fetchMock)
    const page = fetchTennisRecordPage(url, 1000, start + 5000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(page).resolves.toMatchObject({ status: 200, transientRetries: 0 })
    expect(timeout).toHaveBeenCalledWith(4000)
  })

  it('keeps the ordinary 20-second request timeout when enough budget remains', async () => {
    vi.useFakeTimers(); vi.setSystemTime(start)
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Match')))
    const page = fetchTennisRecordPage(url, 1000, start + 180_000)
    await vi.advanceTimersByTimeAsync(1000); await page
    expect(timeout).toHaveBeenCalledWith(20_000)
  })

  it('yields instead of attempting an unpaced retry when the remaining budget is too small', async () => {
    vi.useFakeTimers(); vi.setSystemTime(start)
    const fetchMock = vi.fn().mockImplementation(() => {
      vi.setSystemTime(start + 4500)
      return Promise.reject(new TypeError('fetch failed'))
    })
    vi.stubGlobal('fetch', fetchMock)
    const outcome = fetchTennisRecordPage(url, 1000, start + 5000).catch(error => error)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await outcome).toBeInstanceOf(TennisRecordCheckpointBudgetError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('classifies a body read aborted at the deadline as a planned yield', async () => {
    vi.useFakeTimers(); vi.setSystemTime(start)
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, text: async () => {
      vi.setSystemTime(start + 5000)
      throw new Error('Body read aborted')
    } })
    vi.stubGlobal('fetch', fetchMock)
    const outcome = fetchTennisRecordPage(url, 1000, start + 5000).catch(error => error)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await outcome).toBeInstanceOf(TennisRecordCheckpointBudgetError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still returns real source failures after two normally paced attempts', async () => {
    vi.useFakeTimers(); vi.setSystemTime(start)
    const failure = new TypeError('fetch failed')
    const fetchMock = vi.fn().mockRejectedValue(failure); vi.stubGlobal('fetch', fetchMock)
    const outcome = fetchTennisRecordPage(url, 1000, start + 180_000).catch(error => error)
    await vi.advanceTimersByTimeAsync(2000)
    expect(await outcome).toBe(failure)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('releases budget-limited claims and reaches reconciliation without charging a retry', () => {
    const code = readFileSync('lib/tennisrecord/service.ts', 'utf8')
    const sync = code.slice(code.indexOf('export async function runTennisRecordSync'), code.indexOf('async function reclaimStaleTennisRecordRuns'))
    const budgetCatch = sync.slice(sync.indexOf('if (error instanceof TennisRecordCheckpointBudgetError)'), sync.indexOf('const failureReason'))
    expect(sync).toContain('Date.now() + TENNISRECORD_SOURCE_WORK_BUDGET_MS')
    expect(sync.match(/if \(!hasTennisRecordFetchBudget\(sourceDeadlineAt/g)).toHaveLength(2)
    expect(sync).toContain('fetchTennisRecordPage(job.source_url, settings.min_request_interval_ms, sourceDeadlineAt)')
    expect(budgetCatch).toContain("update({ status: 'pending' })")
    expect(budgetCatch).toContain(".eq('status', 'running')")
    expect(budgetCatch).toContain('if (released.error) throw')
    expect(budgetCatch).toContain('break')
    expect(budgetCatch).not.toMatch(/retry_count|summary\..*Failures|return /)
    expect(sync.indexOf('const reconciled = await reconcileTennisRecordMatches')).toBeGreaterThan(sync.indexOf('if (error instanceof TennisRecordCheckpointBudgetError)'))
  })
})
