import { describe, expect, it } from 'vitest'
import { buildCourtMatchupSummary } from '../captain-court-matchup-summary'
import type { OpponentScoutCourt, OpponentSeasonScout } from '../captain-opponent-season-scout'

const court: OpponentScoutCourt = { key: 'd1', label: 'Doubles 1', slotIndex: 0, slotType: 'doubles', playerIds: ['a', 'b'], playerNames: ['Alex', 'Blake'], result: 'W', score: '7-6 6-1', scoreOriented: true, gamesFor: 13, gamesAgainst: 7, defaulted: false, needsReview: false }
const source = (): OpponentSeasonScout => ({ ready: true, lines: [], fixtures: [1, 5, 3, 4, 2].map(day => ({ key: String(day), date: `2026-09-0${day}`, opponent: 'Rivals', courts: [{ ...court }], wins: 1, losses: 0, unknown: 0, expectedCourts: 1 })) })
describe('court matchup summary', () => {
  it('separates recent match records from season close-set records and counts pairs once', () => {
    expect(buildCourtMatchupSummary(source(), 0, 'doubles')).toMatchObject({ date: '2026-09-05', recentWins: 4, recentLosses: 0, recentSample: 4, close: { wins: 5, losses: 0 }, seasonMatches: 5 })
  })
  it('does not replace missing latest opponents with older players', () => {
    const scout = source()
    scout.fixtures[1].courts = []
    expect(buildCourtMatchupSummary(scout, 0, 'doubles')).toBeNull()
  })
  it('excludes other partners, unknown results and partial scores', () => {
    const scout = source()
    scout.fixtures[0].courts[0].playerIds = ['a', 'c']
    scout.fixtures[2].courts[0].result = null
    scout.fixtures[3].courts[0].score = '6-4 1-0 RET'
    expect(buildCourtMatchupSummary(scout, 0, 'doubles')).toMatchObject({ recentSample: 2, seasonMatches: 2, close: { wins: 2, losses: 0 } })
  })
  it.each([{ defaulted: true }, { needsReview: true }, { playerIds: ['a'] }, { playerIds: ['a', 'a'] }])('keeps unusable latest courts explicit %j', (override) => {
    const scout = source()
    Object.assign(scout.fixtures[1].courts[0], override)
    expect(buildCourtMatchupSummary(scout, 0, 'doubles')).toBeNull()
  })
  it('excludes contradictory observations from both recent and season counts', () => {
    const scout = source()
    scout.fixtures[2].courts.push({ ...court, result: 'L', score: '6-7 1-6' })
    expect(buildCourtMatchupSummary(scout, 0, 'doubles')).toMatchObject({ recentSample: 3, seasonMatches: 4 })
  })
  it('selects the recorded alternate pair without changing the source or substituting the latest pair', () => {
    const scout = source()
    Object.assign(scout.fixtures[2].courts[0], { playerIds: ['a', 'c'], playerNames: ['Alex', 'Casey'], result: 'L', score: '6-7 1-6' })
    const before = JSON.stringify(scout)
    expect(buildCourtMatchupSummary(scout, 0, 'doubles', '3')).toMatchObject({ names: ['Alex', 'Casey'], date: '2026-09-03', patternId: 'pair:["a","c"]', recentWins: 0, recentLosses: 1, recentSample: 1, close: { wins: 0, losses: 1 } })
    expect(JSON.stringify(scout)).toBe(before)
  })
  it('rejects stale and out-of-window selection keys', () => {
    expect(buildCourtMatchupSummary(source(), 0, 'doubles', 'missing')).toBeNull()
    expect(buildCourtMatchupSummary(source(), 0, 'doubles', '1')).toBeNull()
  })
  it('selects an earlier singles occupant while excluding doubles history', () => {
    const scout = source()
    scout.fixtures.forEach((fixture) => Object.assign(fixture.courts[0], { slotType: 'singles', playerIds: [fixture.key === '3' ? 'c' : 'a'], playerNames: [fixture.key === '3' ? 'Casey' : 'Alex'] }))
    expect(buildCourtMatchupSummary(scout, 0, 'singles', '3')).toMatchObject({ names: ['Casey'], patternId: 'player:c', recentSample: 1, seasonMatches: 1 })
  })
})
