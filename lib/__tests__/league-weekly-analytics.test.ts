import { describe, expect, it } from 'vitest'
import { buildWeeklyAnalytics } from '../league-weekly-analytics'
import { buildLeagueWeeklyCompetitionView, type LeagueWeeklyRecordSetResult } from '../league-weekly-player-records'

const sessions = [
  { id: 'w1', league_id: 'l', status: 'completed', play_on: '2026-10-01' },
  { id: 'w2', league_id: 'l', status: 'published', play_on: '2026-10-08' },
]
function result(week: string, set: number, a: number, b: number, sideA = ['Alex', 'Ben'], sideB = ['Chris', 'Dan'], status = 'approved'): LeagueWeeklyRecordSetResult {
  return { session_id: week, court_number: 1, set_number: set, side_a_games: a, side_b_games: b, side_a_players: sideA, side_b_players: sideB, review_status: status }
}
function source(results: LeagueWeeklyRecordSetResult[]) {
  return buildLeagueWeeklyCompetitionView({ leagueId: 'l', playerNames: ['Not playing'], sessions, results })
}
describe('weekly league analytics', () => {
  it('counts league games once, each pair once, and each player once', () => {
    const data = buildWeeklyAnalytics(source([result('w1', 1, 7, 6)]))
    expect(data.view.summary.totalGames).toBe(13)
    expect(data.pairs).toHaveLength(2)
    expect(data.pairs[0]).toMatchObject({ wins: 1, setsPlayed: 1, gamesWon: 7, gamesLost: 6, gameDifferential: 1 })
    expect(data.view.standings).toHaveLength(4)
    expect(data.players.alex).toMatchObject({ closeSets: { wins: 1, losses: 0 }, tiebreaks: { wins: 1, losses: 0 }, rankMovement: null })
    expect(data.closeSets).toBe(1)
    expect(data.tiebreaks).toBe(1)
    expect(data.highlights.some(item => item.title === 'Clean sweep')).toBe(false)
  })
  it('combines unordered, case-insensitive pairs across weeks with opponent records', () => {
    const data = buildWeeklyAnalytics(source([result('w1', 1, 6, 2), result('w2', 1, 4, 6, [' ben ', 'ALEX'])]))
    const pair = data.pairs.find(item => item.players.includes('Alex'))!
    expect(pair).toMatchObject({ wins: 1, losses: 1, setsPlayed: 2, weeksPlayed: 2, gamesWon: 10, gamesLost: 8, gameDifferential: 2 })
    expect(pair.opponents).toEqual([{ players: ['Chris', 'Dan'], wins: 1, losses: 1 }])
    expect(data.players.alex.repeatedPartners).toBe(1)
  })
  it('scopes a week separately from season history', () => {
    const data = buildWeeklyAnalytics(source([result('w1', 1, 6, 2), result('w2', 1, 7, 5)]), 'w2')
    expect(data.view.summary.acceptedSets).toBe(1)
    expect(data.view.summary.totalGames).toBe(12)
    expect(data.playedWeeks).toBe(1)
    expect(data.pairs[0].weeksPlayed).toBe(1)
    expect(data.players.alex.repeatedPartners).toBe(0)
  })
  it('excludes unaccepted scores, unpublished sessions, impossible scores and duplicate players', () => {
    const input = source([result('w1', 1, 6, 4, undefined, undefined, 'pending'), result('w1', 2, 6, 4, undefined, undefined, 'disputed'), result('w2', 1, 6, 5), result('w2', 2, 6, 2, ['Alex', 'Alex'])])
    const data = buildWeeklyAnalytics(input)
    expect(data.view.summary.acceptedSets).toBe(0)
    expect(data.pairs).toEqual([])
    expect(data.highlights).toEqual([])
  })
  it('identifies three-set sweeps and the closest completed court', () => {
    const data = buildWeeklyAnalytics(source([result('w1', 1, 6, 4), result('w1', 2, 7, 6, ['Alex', 'Chris'], ['Ben', 'Dan']), result('w1', 3, 7, 5, ['Alex', 'Dan'], ['Ben', 'Chris'])]))
    expect(data.highlights.find(item => item.title === 'Clean sweep')?.detail).toContain('Alex (3–0)')
    expect(data.highlights.find(item => item.title === 'Closest court')?.detail).toContain('5 games')
    expect(data.players.alex.rankMovement).toBeNull()
  })
  it('compares cumulative ranks before and after a scored week', () => {
    const data = buildWeeklyAnalytics(source([result('w1', 1, 2, 6), result('w2', 1, 6, 0)]), 'w2')
    expect(data.players.alex.rankMovement).toBe(2)
    expect(data.players.chris.rankMovement).toBe(-2)
    expect(data.highlights.find(item => item.title === 'Moving up')?.detail).toContain('2 places')
  })
  it('requires at least three current and prior sets for improvement highlights', () => {
    const short = buildWeeklyAnalytics(source([result('w1', 1, 2, 6), result('w2', 1, 6, 0)]))
    expect(short.highlights.some(item => item.title === 'Finding their stride')).toBe(false)
    const full = buildWeeklyAnalytics(source([1, 2, 3].flatMap(set => [result('w1', set, 2, 6), result('w2', set, 6, 0)])))
    expect(full.highlights.find(item => item.title === 'Finding their stride')?.detail).toContain('10.0')
  })
  it('handles an empty or unknown week without inventing results', () => {
    const data = buildWeeklyAnalytics(source([result('w1', 1, 6, 4)]), 'unknown')
    expect(data.view.summary.acceptedSets).toBe(0)
    expect(data.playedWeeks).toBe(0)
    expect(data.players).toEqual({})
  })
})
