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
      fetchTeamConnections(token),
      fetchTeamConnections(token),
    ])

    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) })
    expect(getCachedTeamConnections(token)).toEqual(first)

    preloadTeamConnections(token)
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await fetchTeamConnections(token, { includeOffers: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/team-connections?includeOffers=1')
  })
})
