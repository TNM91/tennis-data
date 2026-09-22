import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tokenFor = (id: string) => `test.${btoa(JSON.stringify({ sub: id }))}.signature`
const reply = (data: object, status = 200) => new Response(JSON.stringify({ ok: status === 200, ...data }), { status })
const pending = { id: 'roster_contact:captain', teamName: 'Baseline Crew', roles: ['player', 'captain'], status: 'pending' }
const linked = { ...pending, id: 'saved-team', status: 'accepted' }

function mockStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  return values
}

describe('team connections client cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shares the same identity with explicit user IDs and token-derived callers', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => reply({ pending: [], connections: [linked] }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchTeamConnections } = await import('@/lib/team-profile-links-client')
    await fetchTeamConnections(tokenFor('player-a'), { userId: 'player-a' })
    await fetchTeamConnections(tokenFor('player-a'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['accept', 'decline', 'unlink', 'relink', 'restore_roles', 'set_default'] as const)('clears persisted invitations and bypasses server cache after %s', async (action) => {
    const storage = mockStorage()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply({ pending: [pending], connections: [] }))
      .mockResolvedValueOnce(reply({ connection: linked }))
      .mockResolvedValueOnce(reply({ pending: [], connections: [linked] }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchTeamConnections, updateTeamConnection, getCachedTeamConnections } = await import('@/lib/team-profile-links-client')
    const token = tokenFor('player-a')
    await fetchTeamConnections(token, { userId: 'player-a' })
    expect(storage.size).toBe(1)
    await updateTeamConnection({ accessToken: token, connectionId: pending.id, action })
    expect(storage.size).toBe(0)
    expect(getCachedTeamConnections(token, { userId: 'player-a' })).toBeNull()
    expect((await fetchTeamConnections(token)).pending).toEqual([])
    expect(fetchMock.mock.calls[2][0]).toBe('/api/team-connections?refresh=1')
  })

  it('does not revive an accepted invitation from a GET that finishes after the save', async () => {
    mockStorage()
    let finishOldRead!: (response: Response) => void
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOldRead = resolve }))
      .mockResolvedValueOnce(reply({ connection: linked }))
      .mockResolvedValueOnce(reply({ pending: [], connections: [linked] }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchTeamConnections, updateTeamConnection, getCachedTeamConnections } = await import('@/lib/team-profile-links-client')
    const token = tokenFor('player-a')
    const oldRead = fetchTeamConnections(token)
    const sharedOldRead = fetchTeamConnections(token)
    await updateTeamConnection({ accessToken: token, connectionId: pending.id, action: 'accept' })
    const fresh = await fetchTeamConnections(token, { userId: 'player-a' })
    finishOldRead(reply({ pending: [pending], connections: [] }))
    expect(await oldRead).toEqual(fresh)
    expect(await sharedOldRead).toEqual(fresh)
    expect(getCachedTeamConnections(token)?.pending).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retains the invitation if saving fails', async () => {
    const storage = mockStorage()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(reply({ pending: [pending], connections: [] }))
      .mockResolvedValueOnce(reply({ message: 'Save failed' }, 500)))
    const { fetchTeamConnections, updateTeamConnection, getCachedTeamConnections } = await import('@/lib/team-profile-links-client')
    const token = tokenFor('player-a')
    await fetchTeamConnections(token)
    await expect(updateTeamConnection({ accessToken: token, connectionId: pending.id, action: 'accept' })).rejects.toThrow('Save failed')
    expect(getCachedTeamConnections(token)?.pending).toEqual([pending])
    expect(storage.size).toBe(1)
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

    await fetchTeamConnections(token, { force: true, userId: 'player-a' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/team-connections?refresh=1')
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
