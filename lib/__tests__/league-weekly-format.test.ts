import { describe, expect, it } from 'vitest'
import {
  buildLeagueWeeklyCourts,
  buildLeagueWeeklyRecap,
  buildLeagueWeeklyPlayerStats,
  getLeagueWeeklyRosterSummary,
  normalizeLeagueWeeklySettings,
  orderLeagueWeeklyPlayers,
  validateLeagueWeeklySetScore,
} from '../league-weekly-format'

describe('weekly doubles league format', () => {
  it('normalizes owner-controlled feature switches and staggered starts', () => {
    expect(normalizeLeagueWeeklySettings({
      enabled: true,
      collectAvailability: false,
      courtCount: 40,
      startTimes: ['08:00', '08:30', 'bad', '08:00'],
    })).toMatchObject({
      enabled: true,
      collectAvailability: false,
      courtCount: 24,
      startTimes: ['08:00', '08:30'],
    })
  })

  it('gives every player each partner once across three doubles sets', () => {
    const [court] = buildLeagueWeeklyCourts(['A', 'B', 'C', 'D'], {
      enabled: true,
      courtCount: 1,
      startTimes: ['08:00'],
    })
    expect(court.sets).toEqual([
      { setNumber: 1, sideA: ['A', 'B'], sideB: ['C', 'D'] },
      { setNumber: 2, sideA: ['A', 'C'], sideB: ['B', 'D'] },
      { setNumber: 3, sideA: ['A', 'D'], sideB: ['B', 'C'] },
    ])
  })

  it('accepts only first-to-six sets with a tiebreak at 6–6', () => {
    for (const [winner, loser] of [[6, 0], [6, 4], [7, 5], [7, 6]]) {
      expect(validateLeagueWeeklySetScore(winner, loser).valid).toBe(true)
      expect(validateLeagueWeeklySetScore(loser, winner).valid).toBe(true)
    }
    for (const [left, right] of [[6, 5], [6, 6], [7, 4], [8, 6], [10, 8]]) {
      expect(validateLeagueWeeklySetScore(left, right).valid).toBe(false)
    }
  })

  it('cycles courts through staggered start waves and reports overflow', () => {
    const players = Array.from({ length: 21 }, (_, index) => `Player ${index + 1}`)
    const courts = buildLeagueWeeklyCourts(players, { courtCount: 5, startTimes: ['08:00', '08:30'] })
    expect(courts.map((court) => court.startTime)).toEqual(['08:00', '08:30', '08:00', '08:30', '08:00'])
    expect(getLeagueWeeklyRosterSummary(players, { courtCount: 5 })).toEqual({
      playerCount: 21,
      playingCount: 20,
      waitlistCount: 1,
      openSpots: 0,
      courtCount: 5,
    })
  })

  it('turns scores and positive player shares into recap material', () => {
    const courts = buildLeagueWeeklyCourts(['A', 'B', 'C', 'D'], { courtCount: 1 })
    expect(buildLeagueWeeklyRecap({
      leagueName: 'Thursday Doubles',
      playOn: '2026-10-01',
      courts,
      results: [
        { courtNumber: 1, setNumber: 1, sideAGames: 6, sideBGames: 4 },
        { courtNumber: 1, setNumber: 2, sideAGames: 7, sideBGames: 5 },
      ],
      stories: ['Great sportsmanship on Court 1.', 'Great sportsmanship on Court 1.'],
    })).toMatchObject({
      headline: 'Thursday Doubles weekly recap',
      summary: '1 court, 2 completed sets, and 22 games played — 2 sets finished within two games.',
      stories: ['Great sportsmanship on Court 1.'],
    })
  })

  it('builds player scorecards that can seed the next court assignment', () => {
    const courts = buildLeagueWeeklyCourts(['A', 'B', 'C', 'D'], { courtCount: 1 })
    const stats = buildLeagueWeeklyPlayerStats(courts, [
      { courtNumber: 1, setNumber: 1, sideAGames: 6, sideBGames: 4 },
      { courtNumber: 1, setNumber: 2, sideAGames: 6, sideBGames: 2 },
    ])
    expect(stats.find((stat) => stat.playerName === 'A')).toMatchObject({ setsPlayed: 2, setsWon: 2, gamesWon: 12, gamesLost: 6, gameDifferential: 6 })
    expect(orderLeagueWeeklyPlayers(['D', 'C', 'B', 'A', 'New'], stats)[0]).toBe('A')
  })
})
