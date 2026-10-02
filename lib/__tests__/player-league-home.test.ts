import { describe, expect, it } from 'vitest'
import { buildPlayerLeagueHome } from '../player-league-home'
import type { TiqLeagueRecord } from '../tiq-league-registry'

function league(overrides: Partial<TiqLeagueRecord> = {}): TiqLeagueRecord {
  return {
    id: 'league-1', competitionLayer: 'tiq', leagueFormat: 'individual', individualCompetitionFormat: 'round_robin', teamMatchFormatId: 'standard_5_line' as TiqLeagueRecord['teamMatchFormatId'],
    scoringSystem: 'standard', thirdSetRule: 'either', competitionRules: {} as TiqLeagueRecord['competitionRules'], leagueName: 'Thursday Doubles', seasonLabel: 'Fall 2026', seasonStatus: 'active',
    startsOn: '2026-09-01', endsOn: '2026-11-30', maxWeeks: 12, maxMatchEvents: 120, isPublic: true, schedulingMode: 'coordinator_fixed',
    defaultMatchDay: 'Thursday', defaultMatchTime: '08:00', scheduleTimeZone: 'America/Chicago', defaultFacility: 'Riverside', schedulingNotes: '',
    flight: '', locationLabel: 'St. Louis', photoUrl: '', captainTeamName: '', notes: '', weeklySettings: { enabled: true } as TiqLeagueRecord['weeklySettings'],
    teams: [], players: ['Alex Player'], createdAt: '', updatedAt: '', ...overrides,
  }
}

const participation = { leagueId: 'league-1', leagueName: 'Thursday Doubles', seasonLabel: 'Fall 2026', leagueFlight: '', locationLabel: 'St. Louis', playerName: 'Alex Player', playerId: 'player-1', playerLocation: 'St. Louis' }

describe('player league home', () => {
  it('uses stats-only language when rankings are disabled, even before records arrive', () => {
    const view = buildPlayerLeagueHome({
      participations: [participation], leagues: [league({ weeklySettings: { enabled: true, showRankings: false } as TiqLeagueRecord['weeklySettings'] })],
      results: [], playerId: 'player-1', playerName: 'Alex Player', today: '2026-09-30',
    })
    expect(view.active[0].leaderLabel).toBe('Player stats · no competitive rankings')
  })
  it('shows an active player league with personal record and league context', () => {
    const view = buildPlayerLeagueHome({
      participations: [participation], leagues: [league()], playerId: 'player-1', playerName: 'Alex Player', today: '2026-09-30',
      results: [{ id: 'result-1', leagueId: 'league-1', scheduleItemId: '', playerAName: 'Alex Player', playerAId: 'player-1', playerBName: 'Blair', playerBId: 'player-2', winnerPlayerName: 'Alex Player', winnerPlayerId: 'player-1', score: '6-4 6-4', resultDate: '2026-09-20', notes: '', createdAt: '', updatedAt: '' }],
    })
    expect(view.active[0]).toMatchObject({ leagueName: 'Thursday Doubles', formatLabel: 'Weekly doubles', playerRecord: '1-0', resultLabel: '1 result', status: 'active' })
  })

  it('keeps completed seasons under past seasons', () => {
    const view = buildPlayerLeagueHome({ participations: [participation], leagues: [league({ seasonStatus: 'completed' })], results: [], playerId: 'player-1', playerName: 'Alex Player', today: '2026-12-01' })
    expect(view.active).toHaveLength(0)
    expect(view.past[0]).toMatchObject({ statusLabel: 'Past season', cta: 'View season' })
  })

  it('uses accepted weekly sets for the weekly league record and standings', () => {
    const view = buildPlayerLeagueHome({
      participations: [participation], leagues: [league()], results: [], playerId: 'player-1', playerName: 'Alex Player', today: '2026-09-30',
      weeklyRecords: [{
        leagueId: 'league-1', playerName: 'Alex Player', wins: 4, losses: 2, setsPlayed: 6, weeksPlayed: 2, leagueSetCount: 9,
        leaderName: 'Blair', leaderWins: 5, leaderLosses: 1, winPercentage: 67, gameDifferential: 8,
        currentStreak: { outcome: 'W', count: 2 }, recentForm: ['W', 'L', 'W'],
        bestPartner: { playerName: 'Casey', setsPlayed: 3, wins: 2, losses: 1, winPercentage: 67, gameDifferential: 4 },
        latestWeek: { sessionId: 'week-2', playOn: '2026-09-24', wins: 2, losses: 1, gameDifferential: 3, courtNumbers: [2], partners: ['Casey'] },
      }],
    })
    expect(view.active[0]).toMatchObject({
      playerRecord: '4-2', resultLabel: '9 confirmed sets', leaderLabel: 'Blair leads 5-1',
      weeklyPulse: {
        winPercentage: 67,
        gameDifferential: 8,
        currentStreak: { outcome: 'W', count: 2 },
        recentForm: ['W', 'L', 'W'],
        bestPartner: { playerName: 'Casey', wins: 2, losses: 1, setsPlayed: 3 },
        latestWeek: { playOn: '2026-09-24', wins: 2, losses: 1, courtNumbers: [2] },
      },
    })
  })

  it('does not confuse followed players or team leagues with the linked player’s leagues', () => {
    const view = buildPlayerLeagueHome({
      participations: [participation, { ...participation, leagueId: 'league-2', playerId: 'someone-else', playerName: 'Other Player' }],
      leagues: [league(), league({ id: 'league-2', leagueFormat: 'team' })], results: [], playerId: 'player-1', playerName: 'Alex Player', today: '2026-09-30',
    })
    expect(view.active.map((item) => item.leagueId)).toEqual(['league-1'])
  })
})
