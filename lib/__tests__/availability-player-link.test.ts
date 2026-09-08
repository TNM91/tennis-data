import { afterEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from: mock.from } }))
import { availabilityNamePattern, linkAvailabilityPlayer, searchAvailabilityPlayers } from '../availability-player-link'

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('availability player connection', () => {
  it('escapes wildcards while allowing first and last name searches', () => {
    expect(availabilityNamePattern(' Nathan  Meinert ')).toBe('%Nathan%Meinert%')
    expect(availabilityNamePattern('A_%')).toBe('%A\\_\\%%')
  })
  it('filters the public dataset before limiting results and supports cancellation', async () => {
    const signal = new AbortController().signal
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const key of ['select', 'ilike', 'order', 'limit']) query[key] = vi.fn(() => query)
    query.abortSignal = vi.fn().mockResolvedValue({ data: [{ id: 'p', name: 'Taylor', location: 'STL' }], error: null })
    mock.from.mockReturnValue(query)
    expect(await searchAvailabilityPlayers('Taylor', signal)).toHaveLength(1)
    expect(query.select).toHaveBeenCalledWith('id,name,location')
    expect(query.ilike).toHaveBeenCalledWith('name', '%Taylor%')
    expect(query.limit).toHaveBeenCalledWith(8)
    expect(query.abortSignal).toHaveBeenCalledWith(signal)
  })
  it('does not query for an empty or single-character name', async () => {
    expect(await searchAvailabilityPlayers('a', new AbortController().signal)).toEqual([])
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('uses the existing authenticated save and sends no new player or rating fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true, player: { id: 'chosen' }, profile: { linked_player_id: 'chosen' } }))
    vi.stubGlobal('fetch', fetcher)
    expect(await linkAvailabilityPlayer('account-token', 'chosen')).toMatchObject({ linked_player_id: 'chosen' })
    expect(fetcher).toHaveBeenCalledWith('/api/profile/link', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer account-token' }), body: JSON.stringify({ linkedPlayerId: 'chosen' }) }))
  })
  it.each([{ ok: false }, { ok: true, player: { id: 'chosen' }, profile: null }, { ok: true, player: { id: 'chosen' }, profile: { linked_player_id: 'other' } }])('never advances on a failed or mismatched save', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
    await expect(linkAvailabilityPlayer('account-token', 'chosen')).rejects.toThrow('could not be connected')
  })
})
