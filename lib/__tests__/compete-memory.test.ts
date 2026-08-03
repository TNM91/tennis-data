import { describe, expect, it } from 'vitest'
import {
  chooseLatestCompeteResumeState,
  getCompeteResumeHref,
  getCompeteResumeStorageKey,
  isSafeCompeteResumeHref,
  sanitizeCompeteResumeState,
} from '../compete-memory'

describe('Compete resume memory', () => {
  it('keeps resume data scoped to the signed-in account', () => {
    expect(getCompeteResumeStorageKey('player-1')).toContain(':player-1')
    expect(getCompeteResumeStorageKey('player-2')).not.toBe(getCompeteResumeStorageKey('player-1'))
  })

  it('restores exact safe internal destinations', () => {
    const href = '/matchup?type=doubles&a1=1&a2=2&b1=3&b2=4'
    expect(getCompeteResumeHref({ lastSurface: 'matchup', lastHref: href })).toBe(href)
    expect(isSafeCompeteResumeHref(href)).toBe(true)
    expect(isSafeCompeteResumeHref('https://example.com/steal')).toBe(false)
    expect(isSafeCompeteResumeHref('//example.com/steal')).toBe(false)
  })

  it('falls back to an exact event path without keeping private form fields', () => {
    const state = sanitizeCompeteResumeState({
      lastSurface: 'tournament-entry',
      tournamentId: 'summer open',
      tournamentName: 'Summer Open',
      phone: '555-555-5555',
      email: 'player@example.com',
    })
    expect(getCompeteResumeHref(state)).toBe('/tournaments/summer%20open#enter-tournament')
    expect(state).not.toHaveProperty('phone')
    expect(state).not.toHaveProperty('email')
  })

  it('chooses the newest cloud or device state', () => {
    const local = { lastSurface: 'results' as const, lastVisitedAt: '2026-08-03T12:00:00.000Z' }
    const cloud = { lastSurface: 'schedule' as const, lastVisitedAt: '2026-08-03T13:00:00.000Z' }
    expect(chooseLatestCompeteResumeState(local, cloud)).toBe(cloud)
  })
})
