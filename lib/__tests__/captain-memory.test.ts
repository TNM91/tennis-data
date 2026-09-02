import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CAPTAIN_RESUME_STORAGE_KEY,
  chooseLatestCaptainResumeState,
  getCaptainResumeHref,
  getCaptainResumeStorageKey,
  hasExplicitCaptainRouteScope,
  isSafeCaptainResumeHref,
  readCaptainResumeState,
  resolveCaptainMatchContext,
  sanitizeCaptainResumeState,
  writeCaptainResumeState,
} from '../captain-memory'

function installLocalStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  }

  vi.stubGlobal('window', { localStorage })
  return store
}

describe('captain resume memory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps each signed-in account in its own captain context', () => {
    installLocalStorage()

    writeCaptainResumeState({ team: 'Team One', league: 'Dallas', flight: '4.0' }, 'user-1')
    writeCaptainResumeState({ team: 'Team Two', league: 'Austin', flight: '3.5' }, 'user-2')

    expect(readCaptainResumeState('user-1')?.team).toBe('Team One')
    expect(readCaptainResumeState('user-2')?.team).toBe('Team Two')
  })

  it('does not treat old device-wide memory as signed-in account memory', () => {
    const store = installLocalStorage()
    store.set(CAPTAIN_RESUME_STORAGE_KEY, JSON.stringify({ team: 'Previous User Team' }))

    expect(readCaptainResumeState('user-1')).toBeNull()
    expect(readCaptainResumeState()).toEqual({ team: 'Previous User Team' })
  })

  it('uses a stable account-specific storage key', () => {
    expect(getCaptainResumeStorageKey(' user-1 ')).toBe(`${CAPTAIN_RESUME_STORAGE_KEY}:user-1`)
    expect(getCaptainResumeStorageKey(null)).toBe(CAPTAIN_RESUME_STORAGE_KEY)
  })

  it('keeps only safe resumable Captain context', () => {
    expect(sanitizeCaptainResumeState({
      team: '  SuperSmash Bros  ',
      lastTool: 'lineup-builder',
      scenarioId: 'scenario-1',
      matchId: 'match-1',
      weekStatus: 'ready-to-send',
      lineupCount: 3.4,
      pendingResponseCount: 2,
      lastHref: '/captain/lineup-builder?scenario=scenario-1',
      ignored: 'value',
    })).toEqual({
      team: 'SuperSmash Bros',
      lastTool: 'lineup-builder',
      scenarioId: 'scenario-1',
      matchId: 'match-1',
      weekStatus: 'ready-to-send',
      lineupCount: 3,
      pendingResponseCount: 2,
      lastHref: '/captain/lineup-builder?scenario=scenario-1',
    })

    expect(isSafeCaptainResumeHref('https://example.com/captain')).toBe(false)
    expect(isSafeCaptainResumeHref('//example.com/captain')).toBe(false)
  })

  it('opens the exact saved lineup and chooses the newest device state', () => {
    const local = {
      lastTool: 'lineup-builder' as const,
      lastToolLabel: 'Lineup Builder',
      team: 'SuperSmash Bros',
      league: 'Tri-Level',
      flight: '3.5/4.0/4.5',
      matchId: 'match-1',
      scenarioId: 'scenario-1',
      lastVisitedAt: '2026-08-03T12:00:00.000Z',
    }
    const cloud = {
      lastTool: 'team-room' as const,
      lastHref: '/team-room?team=SuperSmash+Bros',
      lastVisitedAt: '2026-08-03T13:00:00.000Z',
    }

    expect(getCaptainResumeHref(local)).toBe(
      '/captain/lineup-builder?team=SuperSmash+Bros&league=Tri-Level&flight=3.5%2F4.0%2F4.5&match=match-1&scenario=scenario-1',
    )
    expect(chooseLatestCaptainResumeState(local, cloud)).toBe(cloud)
  })

  it('starts every new builder entry at the next match instead of reusing an expired saved match', () => {
    expect(resolveCaptainMatchContext(new URLSearchParams('team=SuperSmash+Bros&league=Missouri')))
      .toEqual({ eventDate: '', opponentTeam: '', matchId: '' })
    expect(resolveCaptainMatchContext(new URLSearchParams()))
      .toEqual({ eventDate: '', opponentTeam: '', matchId: '' })
    expect(resolveCaptainMatchContext(new URLSearchParams('team=SuperSmash+Bros&date=2099-09-01&match=next-match')))
      .toEqual({ eventDate: '2099-09-01', opponentTeam: '', matchId: 'next-match' })
  })

  it('recognizes a team card handoff as an intentional Builder selection', () => {
    expect(hasExplicitCaptainRouteScope(new URLSearchParams('team=SuperSmash+Bros&league=Tri-Level'))).toBe(true)
    expect(hasExplicitCaptainRouteScope(new URLSearchParams())).toBe(false)
  })
})
