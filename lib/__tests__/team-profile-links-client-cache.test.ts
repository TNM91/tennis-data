import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('team connections client cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('shares an in-flight request and reuses the warm result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      pending: [],
      connections: [{ id: 'team-1', teamName: 'Baseline Crew' }],
      offers: {
        captain: { available: false, label: '' },
        player: { available: false, label: '' },
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchTeamConnections, preloadTeamConnections } = await import('@/lib/team-profile-links-client')
    const token = 'test-access-token'
    const [first, second] = await Promise.all([
      fetchTeamConnections(token),
      fetchTeamConnections(token),
    ])

    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    preloadTeamConnections(token)
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
