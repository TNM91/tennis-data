import { describe, expect, it } from 'vitest'
import { buildPlayerSetScoreGrid, buildPlayerSetScoreMatches, readPlayerSetScores, type PlayerSetScoreMatch } from '../player-set-score-grid'
import { buildOpponentSeasonScout, buildOpponentSetScorePlayers } from '../captain-opponent-season-scout'

const match = (id: string, score: string, result: 'W' | 'L' | null = 'W', matchType: 'singles' | 'doubles' = 'singles'): PlayerSetScoreMatch => ({ id, score, result, matchType })
const bucket = (matches: PlayerSetScoreMatch[], label: string, mode: 'singles' | 'doubles' = 'singles') => buildPlayerSetScoreGrid(matches, mode).buckets.find((row) => row.label === label)!

describe('player set-score grid', () => {
  it('counts a won set inside a lost match and a lost set inside a won match', () => {
    const records = [match('lost', '7-6 4-6 3-6', 'L'), match('won', '6-7 6-4 6-3')]
    expect(bucket(records, '7–6')).toMatchObject({ wins: 1, losses: 1, winPercentage: 50 })
    expect(bucket(records, '6–4')).toMatchObject({ wins: 1, losses: 1 })
    expect(buildPlayerSetScoreGrid(records, 'singles')).toMatchObject({ totalSets: 6, setWins: 3, setLosses: 3, scoredMatches: 2 })
  })
  it.each(['6-1 6-4', '1-6 4-6'])('supports winner-first and court-side storage for %s', (score) => {
    expect(bucket([match('m', score, 'L')], '6–1')).toMatchObject({ wins: 0, losses: 1 })
  })
  it('keeps singles separate and combines every doubles partner', () => {
    const records = [match('s', '6-1 6-4'), { ...match('d1', '6-1 6-4', 'W', 'doubles'), partner: 'Alex' }, { ...match('d2', '6-1 6-4', 'L', 'doubles'), partner: 'Blair' }]
    expect(bucket(records, '6–1')).toMatchObject({ wins: 1, losses: 0 })
    expect(bucket(records, '6–1', 'doubles')).toMatchObject({ wins: 1, losses: 1 })
    expect(buildPlayerSetScoreGrid(records, 'doubles').scoredMatches).toBe(2)
  })
  it.each(['6-4 3-6 10-8', '6-4 3-6 1-0'])('excludes the deciding match tiebreak in %s', (score) => {
    expect(buildPlayerSetScoreGrid([match('m', score)], 'singles')).toMatchObject({ totalSets: 2, setWins: 1, setLosses: 1 })
  })
  it('does not read parenthetical tiebreak points as another set', () => {
    expect(buildPlayerSetScoreGrid([match('m', '7-6(7-5) 6-4')], 'singles').totalSets).toBe(2)
    expect(bucket([match('m', '7-6(7-5) 6-4')], '7–6').wins).toBe(1)
  })
  it('handles score spacing and en dashes', () => {
    expect(readPlayerSetScores('6 – 1, 7 – 6 (5)', 'W')).toEqual([{ gamesFor: 6, gamesAgainst: 1 }, { gamesFor: 7, gamesAgainst: 6 }])
  })
  it.each(['Default', '6-3 2-1 RET', '6-3', '7-7 6-3', '', '6-4 6-4 6-4'])('excludes unsupported or incomplete %s', (score) => {
    expect(buildPlayerSetScoreGrid([match('m', score)], 'singles')).toMatchObject({ totalSets: 0, excludedMatches: 1, scoredMatches: 0 })
  })
  it('does not infer the player result from the order of a score', () => {
    expect(buildPlayerSetScoreGrid([match('m', '6-3 6-4', null)], 'singles')).toMatchObject({ totalSets: 0, excludedMatches: 1 })
  })
  it('counts two matching sets while listing their scorecard once', () => {
    const row = bucket([match('m', '6-4 6-4')], '6–4')
    expect(row.wins).toBe(2)
    expect(row.matches).toHaveLength(1)
    expect(row.matches[0]).toMatchObject({ wins: 2, losses: 0 })
  })
  it('deduplicates repeated IDs and excludes conflicting observations', () => {
    expect(bucket([match('m', '6-4 6-4'), match('m', '6-4 6-4')], '6–4').wins).toBe(2)
    expect(buildPlayerSetScoreGrid([match('m', '6-4 6-4'), match('m', '6-4 6-4', 'L')], 'singles')).toMatchObject({ totalSets: 0, excludedMatches: 1 })
  })
  it('has no fabricated percentages for zero samples', () => {
    expect(buildPlayerSetScoreGrid([], 'doubles').buckets.every((row) => row.winPercentage === null)).toBe(true)
  })
  it('orders supporting matches newest first', () => {
    expect(bucket([{ ...match('old', '6-4 6-4'), date: '2026-09-01' }, { ...match('new', '6-4 6-4'), date: '2026-10-01' }], '6–4').matches.map((row) => row.match.id)).toEqual(['new', 'old'])
  })
})

describe('player score history adapters', () => {
  const matches = [{ id: 'm', match_type: 'doubles', winner_side: 'B' as const, score: '6-1 6-4' }]
  it('uses the linked player side and deduplicates their seats', () => {
    const links = [{ player_id: 'p', match_id: 'm', side: 'A' as const }, { player_id: 'p', match_id: 'm', side: 'A' as const }]
    expect(buildPlayerSetScoreMatches('p', matches, links)).toMatchObject([{ matchType: 'doubles', result: 'L' }])
  })
  it('keeps unlinked players out and ambiguous sides unresolved', () => {
    expect(buildPlayerSetScoreMatches('p', matches, [])).toEqual([])
    expect(buildPlayerSetScoreMatches('p', matches, [{ player_id: 'p', match_id: 'm', side: 'A' }, { player_id: 'p', match_id: 'm', side: 'B' }])[0].result).toBeNull()
  })
  it('does not guess unknown discipline or results', () => {
    const links = [{ player_id: 'p', match_id: 'm', side: 'B' as const }]
    expect(buildPlayerSetScoreMatches('p', [{ ...matches[0], match_type: null }], links)).toEqual([])
    expect(buildPlayerSetScoreMatches('p', [{ ...matches[0], winner_side: null }], links)[0].result).toBeNull()
  })
  it('uses only scoped opponent fixtures and shares doubles results with both players', () => {
    const records = [{ ...matches[0], line_number: '1', match_date: '2026-10-01', home_team: 'Other', away_team: 'Rivals', league_name: '2026 Fall', flight: '4.0' }]
    const links = [{ player_id: 'p', match_id: 'm', side: 'B' as const, seat: 1 }, { player_id: 'q', match_id: 'm', side: 'B' as const, seat: 2 }, { player_id: 'r', match_id: 'm', side: 'A' as const, seat: 1 }]
    const scout = buildOpponentSeasonScout({ opponent: 'Rivals', league: '2026 Fall', flight: '4.0', beforeDate: '2026-10-11', matches: [...records, { ...records[0], id: 'future', match_date: '2026-10-12' }, { ...records[0], id: 'other', league_name: '2026 Spring' }], links, players: [{ id: 'p', name: 'Alex' }, { id: 'q', name: 'Blair' }], slots: [] })
    const players = buildOpponentSetScorePlayers(scout)
    expect(players.map((player) => player.id)).toEqual(['p', 'q'])
    expect(players.every((player) => player.matches.length === 1)).toBe(true)
    expect(bucket(players[0].matches, '6–1', 'doubles').wins).toBe(1)
    expect(players[0].matches[0].partner).toBe('Blair')
  })
})
