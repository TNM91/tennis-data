import { beforeEach, describe, expect, it, vi } from 'vitest'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('private client snapshots', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.stubGlobal('window', { localStorage: createStorage() })
  })

  it('keeps a last-good response scoped to the signed-in account', async () => {
    const { readPrivateClientSnapshot, writePrivateClientSnapshot } = await import('@/lib/private-client-snapshot')
    writePrivateClientSnapshot({ namespace: 'teams', userId: 'player-a', scope: 'default', value: { team: 'Baseline Crew' } })

    expect(readPrivateClientSnapshot<{ team: string }>({
      namespace: 'teams',
      userId: 'player-a',
      scope: 'default',
      maxAgeMs: 60_000,
    })?.value).toEqual({ team: 'Baseline Crew' })
    expect(readPrivateClientSnapshot({
      namespace: 'teams',
      userId: 'player-b',
      scope: 'default',
      maxAgeMs: 60_000,
    })).toBeNull()
  })

  it('can retain an expired snapshot only when a caller explicitly allows it', async () => {
    vi.useFakeTimers()
    const { readPrivateClientSnapshot, writePrivateClientSnapshot } = await import('@/lib/private-client-snapshot')
    writePrivateClientSnapshot({ namespace: 'captain-lineup', userId: 'captain-a', value: { roster: ['Alex'] } })
    vi.advanceTimersByTime(61_000)

    expect(readPrivateClientSnapshot({ namespace: 'captain-lineup', userId: 'captain-a', maxAgeMs: 60_000 })).toBeNull()
    expect(readPrivateClientSnapshot<{ roster: string[] }>({
      namespace: 'captain-lineup',
      userId: 'captain-a',
      maxAgeMs: 60_000,
      allowStale: true,
    })).toMatchObject({ value: { roster: ['Alex'] }, stale: true })
    vi.useRealTimers()
  })
})
