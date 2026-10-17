import { describe, expect, it, vi } from 'vitest'
import { loadTeamDirectoryPages } from '@/lib/team-directory-pages'

describe('team directory pagination', () => {
  it('loads older rows beyond the database response cap', async () => {
    const rows = Array.from({ length: 1204 }, (_, id) => ({ id }))
    const fetch = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
    expect(await loadTeamDirectoryPages(fetch)).toEqual({ data: rows, error: null })
    expect(fetch.mock.calls).toEqual([[0, 999], [1000, 1999]])
  })
  it('does not show partial totals when a later page fails', async () => {
    const error = { message: 'Unavailable' }
    const fetch = vi.fn().mockResolvedValueOnce({ data: Array(1000).fill(1), error: null }).mockResolvedValueOnce({ data: null, error })
    expect(await loadTeamDirectoryPages(fetch)).toEqual({ data: null, error })
  })
  it('keeps the existing 10,000-row limit', async () => {
    const fetch = vi.fn(async () => ({ data: Array(1000).fill(1), error: null }))
    expect((await loadTeamDirectoryPages(fetch)).data).toHaveLength(10000)
    expect(fetch).toHaveBeenCalledTimes(10)
  })
})
