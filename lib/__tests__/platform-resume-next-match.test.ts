import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyAutomaticCaptainNextMatch,
  buildCaptainResumeScopeKey,
  buildCaptainResumeTeamScopes,
  captainResumeHasCurrentMatch,
  chooseCaptainResumeNextMatch,
  type CaptainResumeNextMatch,
  type CaptainResumeTeamScope,
} from '../platform-resume-next-match'

const defaultScope: CaptainResumeTeamScope = {
  team: 'SuperSmash Bros',
  league: 'Tri-Level',
  flight: '3.5/4.0/4.5',
  isDefault: true,
  updatedAt: '2026-08-03T12:00:00.000Z',
}

const otherScope: CaptainResumeTeamScope = {
  team: 'Baseline Crew',
  league: 'Adult 18+',
  flight: '4.0',
  isDefault: false,
  updatedAt: '2026-08-03T13:00:00.000Z',
}

function nextMatch(
  scope: CaptainResumeTeamScope,
  date: string,
  source: CaptainResumeNextMatch['source'] = 'usta',
): CaptainResumeNextMatch {
  return {
    source,
    matchId: `${scope.team}-${date}`,
    scopeKey: buildCaptainResumeScopeKey(scope),
    team: scope.team,
    league: scope.league,
    flight: scope.flight,
    date,
    time: '18:00:00',
    opponent: 'Topspin Club',
    facility: 'Northside Tennis Center',
  }
}

describe('automatic Captain next match', () => {
  it('uses accepted Captain roles and keeps the chosen default team first', () => {
    const scopes = buildCaptainResumeTeamScopes([
      {
        id: 'player-only',
        team_name: 'Player Team',
        team_roles: ['player'],
        status: 'accepted',
        is_default: false,
      },
      {
        id: 'other-captain',
        team_name: otherScope.team,
        league_name: otherScope.league,
        flight: otherScope.flight,
        team_roles: ['captain'],
        status: 'accepted',
        is_default: false,
        updated_at: otherScope.updatedAt,
      },
      {
        id: 'default-co-captain',
        team_name: defaultScope.team,
        league_name: defaultScope.league,
        flight: defaultScope.flight,
        team_roles: ['player', 'co_captain'],
        status: 'accepted',
        is_default: true,
        updated_at: defaultScope.updatedAt,
      },
    ])

    expect(scopes.map((scope) => scope.team)).toEqual([defaultScope.team, otherScope.team])
    expect(buildCaptainResumeTeamScopes([{
      id: 'player-only',
      team_name: 'Player Team',
      team_roles: ['player'],
      status: 'accepted',
    }], {
      linked_team_name: 'Player Team',
    })).toEqual([])
  })

  it('uses the default team before an earlier match on another team', () => {
    const selected = chooseCaptainResumeNextMatch(
      [defaultScope, otherScope],
      [nextMatch(otherScope, '2026-08-04'), nextMatch(defaultScope, '2026-08-08', 'tiq')],
    )

    expect(selected).toMatchObject({ team: defaultScope.team, date: '2026-08-08', source: 'tiq' })
  })

  it('falls back to the earliest linked-team match when the default team has none', () => {
    expect(chooseCaptainResumeNextMatch(
      [defaultScope, otherScope],
      [nextMatch(otherScope, '2026-08-05'), nextMatch(otherScope, '2026-08-04', 'tiq')],
    )).toMatchObject({ team: otherScope.team, date: '2026-08-04', source: 'tiq' })
  })

  it('keeps a saved current match and resets stale week-specific state for a new match', () => {
    const today = '2026-08-03'
    const savedCurrent = {
      team: defaultScope.team,
      eventDate: '2026-08-06',
      lastTool: 'lineup-builder' as const,
      weekStatus: 'draft-lineup' as const,
      lineupCount: 2,
    }
    expect(captainResumeHasCurrentMatch(savedCurrent, today)).toBe(true)
    expect(applyAutomaticCaptainNextMatch(savedCurrent, nextMatch(defaultScope, '2026-08-08'), today)).toBe(savedCurrent)

    const refreshed = applyAutomaticCaptainNextMatch({
      ...savedCurrent,
      eventDate: '2026-07-20',
      pendingResponseCount: 3,
    }, nextMatch(defaultScope, '2026-08-08'), today, '2026-08-03T14:00:00.000Z')

    expect(refreshed).toMatchObject({
      team: defaultScope.team,
      eventDate: '2026-08-08',
      lastTool: 'hub',
      opponentTeam: 'Topspin Club',
    })
    expect(refreshed).not.toHaveProperty('weekStatus')
    expect(refreshed).not.toHaveProperty('lineupCount')
    expect(refreshed).not.toHaveProperty('pendingResponseCount')
  })

  it('loads both imported and TIQ schedules only when saved match context is stale', () => {
    const source = readFileSync(join(process.cwd(), 'lib/platform-resume-next-match.ts'), 'utf8')
    const route = readFileSync(join(process.cwd(), 'app/api/resume/overview/route.ts'), 'utf8')

    expect(source).toContain(".from('matches')")
    expect(source).toContain(".in('league_name', leagueNames)")
    expect(source).toContain(".from('tiq_league_schedule_items')")
    expect(source).toContain('scheduled_date,scheduled_time,facility')
    expect(source).toContain('loadCaptainResumeNextMatchForScope')
    expect(source).toContain(".in('status', ['confirmed', 'coordinator_set'])")
    expect(source).toContain('loadCaptainResumeNextMatchFromCloud')
    expect(source).toContain('} catch {')
    expect(route).toContain('if (!captainResumeHasCurrentMatch(states.captain, today))')
    expect(route).toContain('applyAutomaticCaptainNextMatch(states.captain, nextMatch, today)')
  })
})
