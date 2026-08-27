import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('team connections client cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('shares an in-flight request and reuses the warm result', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      ok: true,
      pending: [],
      connections: [{ id: 'team-1', teamName: 'Baseline Crew' }],
      offers: {
        captain: { available: false, label: '' },
        player: { available: false, label: '' },
      },
    }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchTeamConnections, getCachedTeamConnections, preloadTeamConnections } = await import('@/lib/team-profile-links-client')
    const token = 'test-access-token'
    const [first, second] = await Promise.all([
      fetchTeamConnections(token, { userId: 'player-a' }),
      fetchTeamConnections(token, { userId: 'player-a' }),
    ])

    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) })
    expect(getCachedTeamConnections(token, { userId: 'player-a' })).toEqual(first)

    preloadTeamConnections(token, { userId: 'player-a' })
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await fetchTeamConnections(token, { includeOffers: true, userId: 'player-a' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/team-connections?includeOffers=1')
  })

  it('keeps the last-good team connection after a mobile session token changes', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    })
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      ok: true,
      pending: [],
      connections: [{ id: 'team-1', teamName: 'Baseline Crew' }],
      offers: {
        captain: { available: false, label: '' },
        player: { available: false, label: '' },
      },
    }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchTeamConnections, getCachedTeamConnections } = await import('@/lib/team-profile-links-client')
    const first = await fetchTeamConnections('first-token', { userId: 'player-a' })

    expect(getCachedTeamConnections('renewed-token', { userId: 'player-a' })).toEqual(first)
    expect(getCachedTeamConnections('renewed-token', { userId: 'player-b' })).toBeNull()
  })
})
