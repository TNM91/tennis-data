import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRatingTimingObserver, emitImporterTelemetry, sourceTransportFailure, type SourceAttemptSample } from '../tennisrecord/telemetry'
import { fetchTennisRecordPage, TennisRecordCheckpointBudgetError } from '../tennisrecord/collector'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('sanitized source attempt timings', () => {
  it.each([
    [new DOMException('private source URL', 'TimeoutError'), 'timeout'],
    [{ cause: { code: 'EAI_AGAIN' } }, 'dns'],
    [{ cause: { code: 'ECONNRESET' } }, 'connection'],
    [{ cause: { code: 'ERR_TLS_CERT_ALTNAME_INVALID' } }, 'tls'],
    [{ code: 'UND_ERR_BODY_TIMEOUT' }, 'timeout'],
    [{ message: 'sensitive source content', code: 'UNEXPECTED_SECRET' }, 'network'],
    [null, 'network'],
  ])('categorizes without retaining arbitrary error details', (error, category) => {
    expect(sourceTransportFailure(error)).toBe(category)
  })

  it('records failed and successful attempts separately without changing retries', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('private details', { cause: { code: 'ENOTFOUND' } })).mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 37))
      return new Response('<main>Private source body</main>')
    })
    vi.stubGlobal('fetch', fetchMock)
    const samples = vi.fn()
    const page = fetchTennisRecordPage('https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Private+Name&year=2026', 1000, undefined, samples)
    await vi.advanceTimersByTimeAsync(2037)
    await expect(page).resolves.toMatchObject({ status: 200, transientRetries: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(samples.mock.calls.map(([sample]) => sample)).toEqual([
      { attempt: 1, outcome: 'dns', status: null, pacing_ms: 1000, fetch_ms: 0 },
      { attempt: 2, outcome: 'success', status: 200, pacing_ms: 1000, fetch_ms: 37 },
    ])
    expect(JSON.stringify(samples.mock.calls)).not.toMatch(/Private|private|playername|tennisrecord.com|ENOTFOUND/)
  })

  it('does not turn a logging failure into a source retry or block bypass', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(new Response('Access denied', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)
    const observer = vi.fn<(sample: SourceAttemptSample) => void>(() => { throw new Error('logger unavailable') })
    const page = fetchTennisRecordPage('https://www.tennisrecord.com/adult/matchresults.aspx?mid=1', 1000, undefined, observer)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(page).resolves.toMatchObject({ status: 403, blockReason: 'http_403', transientRetries: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(observer.mock.calls[0][0]).toMatchObject({ outcome: 'blocked' })
  })

  it('reports timeout errors while preserving the original terminal error', async () => {
    vi.useFakeTimers()
    const error = new DOMException('timed out', 'TimeoutError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    const samples = vi.fn()
    const rejected = expect(fetchTennisRecordPage('https://www.tennisrecord.com/adult/profile.aspx', 1000, undefined, samples)).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(2000)
    await rejected
    expect(samples.mock.calls.map(([sample]) => sample.outcome)).toEqual(['timeout', 'timeout'])
  })

  it('does not report a fetch attempt when no request fits the source budget', async () => {
    const samples = vi.fn()
    await expect(fetchTennisRecordPage('https://www.tennisrecord.com/adult/profile.aspx', 1000, Date.now(), samples)).rejects.toBeInstanceOf(TennisRecordCheckpointBudgetError)
    expect(samples).not.toHaveBeenCalled()
  })
})

describe('rating phase timing', () => {
  it('measures actual phase boundaries and emits one final summary', () => {
    let now = 0
    const emit = vi.fn()
    const timer = createRatingTimingObserver('run-1', () => now, emit)
    timer.onPhase('fetching-players')
    now = 10; timer.onPhase('fetching-matches')
    now = 30; timer.onPhase('fetching-participants')
    now = 60; timer.onPhase('processing')
    now = 100; timer.onPhase('finalizing')
    now = 110; timer.onPhase('saving-ratings')
    now = 160; timer.onPhase('saving-snapshots')
    now = 260; timer.onPhase('done')
    now = 262; timer.finish('completed')
    timer.finish('failed')
    timer.onPhase('processing')
    const events = emit.mock.calls.map(([event]) => event)
    expect(events.filter(e => e.kind === 'engine_finished')).toEqual([{
      event: 'tennisrecord_rating_timing', run_id: 'run-1', kind: 'engine_finished', status: 'completed', duration_ms: 262,
      phases_ms: { 'fetching-players': 10, 'fetching-matches': 20, 'fetching-participants': 30, processing: 40, finalizing: 10, 'saving-ratings': 50, 'saving-snapshots': 100 },
    }])
    expect(events.filter(e => e.kind === 'phase_started')).toHaveLength(7)
  })

  it('records the failing phase and keeps instrumentation failures nonfatal', () => {
    let now = 0
    const emit = vi.fn()
    const timer = createRatingTimingObserver('run-2', () => now, emit)
    timer.onPhase('saving-snapshots'); now = 15; timer.finish('failed')
    expect(emit.mock.calls.map(([e]) => e)).toContainEqual(expect.objectContaining({ kind: 'phase_finished', phase: 'saving-snapshots', status: 'failed', duration_ms: 15 }))
    const unavailable = createRatingTimingObserver('run-3', () => 0, () => { throw new Error('unavailable') })
    expect(() => { unavailable.onPhase('fetching-players'); unavailable.finish('failed') }).not.toThrow()
    vi.spyOn(console, 'info').mockImplementation(() => { throw new Error('unavailable') })
    expect(() => emitImporterTelemetry({ event: 'fixture' })).not.toThrow()
  })
})
