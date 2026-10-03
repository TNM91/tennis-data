import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from '../recalculateRatings'
afterEach(() => vi.unstubAllGlobals())
describe('browser rating refresh', () => {
  it('queues authenticated activity without reading or writing rating tables', async () => {
    vi.stubGlobal('window', {})
    const fetcher = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', fetcher)
    const from = vi.fn(), client = { from, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-session' } }, error: null }) } } as unknown as SupabaseClient
    const result = await recalculateDynamicRatings(undefined, client)
    expect(result.queued).toBe(true)
    expect(from).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledWith('/api/ratings/refresh', { method: 'POST', headers: { Authorization: 'Bearer test-session' } })
  })
  it('does not queue unauthenticated activity', async () => {
    vi.stubGlobal('window', {})
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } } as unknown as SupabaseClient
    await expect(recalculateDynamicRatings(undefined, client)).rejects.toThrow('Sign in')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
