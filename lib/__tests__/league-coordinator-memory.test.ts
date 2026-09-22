import { describe, expect, it } from 'vitest'
import {
  LEAGUE_COORDINATOR_RESUME_STORAGE_KEY,
  buildLeagueCoordinatorHref,
  chooseLatestLeagueCoordinatorResumeState,
  getLeagueCoordinatorResumeHref,
  getLeagueCoordinatorResumeStorageKey,
  sanitizeLeagueCoordinatorResumeState,
} from '../league-coordinator-memory'

describe('league coordinator memory', () => {
  it('scopes browser storage to the signed-in account', () => {
    expect(getLeagueCoordinatorResumeStorageKey(' coordinator-1 ')).toBe(
      `${LEAGUE_COORDINATOR_RESUME_STORAGE_KEY}:coordinator-1`,
    )
  })

  it('sanitizes resume fields and blocks external resume URLs', () => {
    expect(sanitizeLeagueCoordinatorResumeState({
      leagueId: ' league-1 ',
      leagueName: ' Summer doubles ',
      leagueFormat: 'team',
      lastSurface: 'team-results',
      lastHref: 'https://example.com/steal',
      teamResultDraft: { teamAName: ' A ', teamBName: ' B ', notes: ' Ready ' },
    })).toEqual({
      leagueId: 'league-1',
      leagueName: 'Summer doubles',
      leagueFormat: 'team',
      lastSurface: 'team-results',
      teamResultDraft: { teamAName: 'A', teamBName: 'B', notes: 'Ready' },
    })
  })

  it('chooses the newest device or cloud state', () => {
    const local = { leagueId: 'one', lastVisitedAt: '2026-08-03T10:00:00.000Z' }
    const cloud = { leagueId: 'two', lastVisitedAt: '2026-08-03T11:00:00.000Z' }
    expect(chooseLatestLeagueCoordinatorResumeState(local, cloud)).toBe(cloud)
  })

  it('builds exact league, tournament, and conversation resume destinations', () => {
    expect(buildLeagueCoordinatorHref('team-results', 'league 1')).toBe('/league-coordinator/results?leagueId=league%201')
    expect(getLeagueCoordinatorResumeHref({
      lastSurface: 'tournament',
      tournamentId: 'event 1',
    })).toBe('/league-coordinator/tournaments?tournamentId=event%201#tournament-setup')
    expect(getLeagueCoordinatorResumeHref({
      lastSurface: 'conversation',
      conversationId: 'thread 1',
    })).toBe('/messages?thread=thread%201')
  })
})
