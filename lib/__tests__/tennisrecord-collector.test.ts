import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTennisRecordPage } from '../tennisrecord/collector'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('TennisRecord collector retry safety', () => {
  it('retries one thrown network error with the normal pacing interval', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('<main>Public match page</main>', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const pagePromise = fetchTennisRecordPage('https://www.tennisrecord.com/adult/matchresults.aspx?mid=1', 1)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(pagePromise).resolves.toMatchObject({ status: 200, transientRetries: 1, blockReason: '' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry an access block response', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(new Response('<title>Access denied</title>', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    const pagePromise = fetchTennisRecordPage('https://www.tennisrecord.com/adult/matchresults.aspx?mid=1', 1)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(pagePromise).resolves.toMatchObject({ status: 403, transientRetries: 0, blockReason: 'http_403' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
