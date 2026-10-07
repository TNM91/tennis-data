import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../app/api/security/csp-report/route'

describe('CSP report collection', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('consolidates repeated reports while logging new signatures and later recurrence', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const send = (blockedURL: string) => POST(new Request('https://www.tenaceiq.com/api/security/csp-report', {
      method: 'POST',
      body: JSON.stringify({ body: { effectiveDirective: 'img-src', blockedURL } }),
    }))
    await send('https://repeated.example/a')
    await send('https://repeated.example/b')
    expect(warning).toHaveBeenCalledTimes(1)
    await send('https://distinct.example/a')
    expect(warning).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(5 * 60_000)
    await send('https://repeated.example/a')
    expect(warning).toHaveBeenCalledTimes(3)
    expect(warning.mock.calls[2][1]).toMatchObject({ repeatedReports: 1 })
  })

  it('accepts and minimizes legacy CSP reports', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const response = await POST(new Request('https://www.tenaceiq.com/api/security/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({
        'csp-report': {
          'effective-directive': 'script-src-elem',
          'blocked-uri': 'https://unexpected.example/tracker.js?player=private',
          'document-uri': 'https://www.tenaceiq.com/players/private-player-id',
          'source-file': 'https://unexpected.example/tracker.js?token=secret',
        },
      }),
    }))

    expect(response.status).toBe(204)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(warning).toHaveBeenCalledWith('[security:csp-report]', {
      directive: 'script-src-elem',
      blockedResource: 'https://unexpected.example',
      documentOrigin: 'https://www.tenaceiq.com',
      sourceOrigin: 'https://unexpected.example',
      disposition: 'report',
    })
  })

  it('accepts Reporting API batches', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const response = await POST(new Request('https://www.tenaceiq.com/api/security/csp-report', {
      method: 'POST',
      body: JSON.stringify([{ body: { effectiveDirective: 'connect-src', blockedURL: 'inline' } }]),
    }))

    expect(response.status).toBe(204)
    expect(warning).toHaveBeenCalledOnce()
  })

  it('rejects invalid and oversized payloads', async () => {
    const invalid = await POST(new Request('https://www.tenaceiq.com/api/security/csp-report', {
      method: 'POST',
      body: 'not json',
    }))
    const oversized = await POST(new Request('https://www.tenaceiq.com/api/security/csp-report', {
      method: 'POST',
      headers: { 'content-length': '20000' },
      body: '{}',
    }))

    expect(invalid.status).toBe(400)
    expect(oversized.status).toBe(413)
  })
})
