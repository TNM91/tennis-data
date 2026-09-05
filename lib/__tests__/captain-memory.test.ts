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
  syncCaptainResumeState,
  writeCaptainResumeState,
} from '../captain-memory'

function installLocalStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  }

  vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })
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

  it.each([
    { team: 'Team Two', league: 'Fall', flight: '4.0' },
    { team: 'Team One', league: 'Spring', flight: '4.0' },
    { team: 'Team One', league: 'Fall', flight: '4.5' },
  ])('does not carry another team or season into the next workspace: %j', (scope) => {
    installLocalStorage()
    writeCaptainResumeState({
      team: 'Team One', league: 'Fall', flight: '4.0', competitionLayer: 'usta',
      lastTool: 'lineup-builder', scenarioId: 'old-lineup', matchId: 'old-match',
      eventDate: '2099-09-14', opponentTeam: 'Old Opponent', teamRoomId: 'old-room',
      weekStatus: 'finalized', lineupCount: 3, pendingResponseCount: 2,
      lastHref: '/captain/lineup-builder?team=Team+One&scenario=old-lineup',
    }, 'user-1')

    writeCaptainResumeState({ ...scope, lastTool: 'team-room' }, 'user-1')
    const saved = readCaptainResumeState('user-1')
    expect(saved).toMatchObject(scope)
    for (const key of ['scenarioId', 'matchId', 'eventDate', 'opponentTeam', 'teamRoomId', 'weekStatus', 'lineupCount', 'pendingResponseCount', 'lastHref']) {
      expect(saved).not.toHaveProperty(key)
    }
    expect(getCaptainResumeHref(saved)).toContain('/team-room?')
    expect(getCaptainResumeHref(saved)).not.toContain('old-')
  })

  it('preserves an existing match when updating the same team workspace', () => {
    installLocalStorage()
    writeCaptainResumeState({ team: 'Team One', league: 'Fall', flight: '4.0', scenarioId: 'saved-lineup' }, 'user-1')
    writeCaptainResumeState({ team: ' Team One ', league: 'Fall', flight: '4.0', lineupCount: 3 }, 'user-1')
    expect(readCaptainResumeState('user-1')).toMatchObject({ team: 'Team One', scenarioId: 'saved-lineup', lineupCount: 3 })
  })

  it('syncs the new team to cloud without the old lineup identifiers', async () => {
    installLocalStorage()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    writeCaptainResumeState({ team: 'Team One', league: 'Fall', flight: '4.0', scenarioId: 'old-lineup' }, 'user-1')
    await syncCaptainResumeState({ team: 'Team Two', league: 'Spring', flight: '4.5', lastTool: 'team-room' }, 'user-1', 'test-token')
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).resume
    expect(sent).toMatchObject({ team: 'Team Two', league: 'Spring', flight: '4.5' })
    expect(sent).not.toHaveProperty('scenarioId')
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
