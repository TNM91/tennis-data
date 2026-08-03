import { describe, expect, it } from 'vitest'
import {
  chooseLatestExploreResumeState,
  getExploreResumeHref,
  getExploreResumeStorageKey,
  isSafeExploreResumeHref,
  sanitizeExploreResumeState,
} from '../explore-memory'

describe('Explore resume memory', () => {
  it('scopes resume state to the signed-in account', () => {
    expect(getExploreResumeStorageKey('player-1')).not.toBe(getExploreResumeStorageKey('player-2'))
    expect(getExploreResumeStorageKey('player-1')).toContain(':player-1')
  })

  it('keeps an exact safe directory or detail URL', () => {
    const href = '/explore/players?q=Lee&sort=singles&flight=4.0'
    expect(getExploreResumeHref({ lastSurface: 'players', lastHref: href })).toBe(href)
    expect(isSafeExploreResumeHref(href)).toBe(true)
    expect(isSafeExploreResumeHref('https://example.com/players')).toBe(false)
    expect(isSafeExploreResumeHref('//example.com/players')).toBe(false)
  })

  it('stores only small navigation context', () => {
    const state = sanitizeExploreResumeState({
      lastSurface: 'player',
      lastHref: '/players/123',
      contextLabel: 'Casey Lee',
      email: 'casey@example.com',
    })
    expect(state).toEqual({ lastSurface: 'player', lastHref: '/players/123', contextLabel: 'Casey Lee' })
  })

  it('selects the newest device or cloud view', () => {
    const local = { lastSurface: 'teams' as const, lastVisitedAt: '2026-08-03T13:00:00.000Z' }
    const cloud = { lastSurface: 'rankings' as const, lastVisitedAt: '2026-08-03T14:00:00.000Z' }
    expect(chooseLatestExploreResumeState(local, cloud)).toBe(cloud)
  })
})
