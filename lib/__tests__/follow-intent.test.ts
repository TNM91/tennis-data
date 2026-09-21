import { describe, expect, it } from 'vitest'
import { claimFollowIntentTracking, peekFollowIntent, rememberFollowIntent, takeFollowIntent } from '../follow-intent'

function makeStore() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

const player = { entity_type: 'player' as const, entity_id: 'p-1', entity_name: 'Jordan' }

describe('follow intent after upgrade', () => {
  it('consumes only the requested follow on its return page', () => {
    const store = makeStore()
    rememberFollowIntent(store, player, '/players/p-1', null, 1000)
    expect(takeFollowIntent(store, { ...player, entity_id: 'p-2' }, '/players/p-1', 'user-1', 2000)).toBe(false)
    expect(takeFollowIntent(store, player, '/players/p-2', 'user-1', 2000)).toBe(false)
    expect(takeFollowIntent(store, player, '/players/p-1', 'user-1', 2000)).toBe(true)
    expect(takeFollowIntent(store, player, '/players/p-1', 'user-1', 2000)).toBe(false)
  })

  it('shows only the matching pending follow on the upgrade return path', () => {
    const store = makeStore()
    rememberFollowIntent(store, player, '/players/p-1', null, 1000)
    expect(peekFollowIntent(store, '/players/p-2', null, 2000)).toBeNull()
    expect(peekFollowIntent(store, '/players/p-1', null, 2000)).toEqual({ entityType: 'player', entityName: 'Jordan' })
    expect(peekFollowIntent(store, '/players/p-1', null, 2000)).toEqual({ entityType: 'player', entityName: 'Jordan' })
  })

  it('does not show another account’s pending follow', () => {
    const store = makeStore()
    rememberFollowIntent(store, player, '/players/p-1', 'user-1', 1000)
    expect(peekFollowIntent(store, '/players/p-1', 'user-2', 2000)).toBeNull()
    expect(peekFollowIntent(store, '/players/p-1', 'user-1', 2000)?.entityName).toBe('Jordan')
  })

  it('will not transfer a signed-in member’s intent to another account', () => {
    const store = makeStore()
    rememberFollowIntent(store, player, '/players/p-1', 'user-1', 1000)
    expect(takeFollowIntent(store, player, '/players/p-1', 'user-2', 2000)).toBe(false)
    expect(takeFollowIntent(store, player, '/players/p-1', 'user-1', 2000)).toBe(false)
  })

  it('attributes an anonymous click once after sign-in and binds the follow to that account', () => {
    const store = makeStore()
    rememberFollowIntent(store, player, '/players/p-1', null, 1000)
    expect(claimFollowIntentTracking(store, '/players/p-2', 'user-1', 2000)).toBeNull()
    expect(claimFollowIntentTracking(store, '/players/p-1', 'user-1', 2000)).toBe('player')
    expect(claimFollowIntentTracking(store, '/players/p-1', 'user-1', 2000)).toBeNull()
    expect(takeFollowIntent(store, player, '/players/p-1', 'user-2', 2000)).toBe(false)

    const sameAccountStore = makeStore()
    rememberFollowIntent(sameAccountStore, player, '/players/p-1', null, 1000)
    expect(claimFollowIntentTracking(sameAccountStore, '/players/p-1', 'user-1', 2000)).toBe('player')
    expect(takeFollowIntent(sameAccountStore, player, '/players/p-1', 'user-1', 2000)).toBe(true)
  })

  it('does not attribute a signed-in click again on the upgrade page', () => {
    const store = makeStore()
    rememberFollowIntent(store, player, '/players/p-1', 'user-1', 1000)
    expect(claimFollowIntentTracking(store, '/players/p-1', 'user-1', 2000)).toBeNull()
    expect(takeFollowIntent(store, player, '/players/p-1', 'user-1', 2000)).toBe(true)
  })

  it('expires old intents so a later visit does not create an unexpected follow', () => {
    const store = makeStore()
    rememberFollowIntent(store, player, '/players/p-1', null, 1000)
    expect(takeFollowIntent(store, player, '/players/p-1', 'user-1', 1000 + 60 * 60 * 1000 + 1)).toBe(false)
  })
})
