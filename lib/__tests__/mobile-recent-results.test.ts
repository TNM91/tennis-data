import { describe, expect, it } from 'vitest'
import { matchDate, matchResult, type RecentMatchRow } from '../../mobile/src/recent-results'

const match: RecentMatchRow = {
  id: 'match', match_date: '2026-10-23', match_type: 'Doubles', league_name: 'League',
  score: '6-4 6-3', winner_side: 'A', match_players: [{player_id: 'linked', side: 'A'}],
}
describe('bundled recent results', () => {
  it('reads the result from the linked player’s side, not score ordering', () => {
    expect(matchResult(match, 'linked')).toBe('Won')
    expect(matchResult({...match, winner_side: 'B'}, 'linked')).toBe('Lost')
  })
  it('does not invent a loss when participant or winner data is missing or unknown', () => {
    expect(matchResult(match, 'other')).toBe('Result pending')
    expect(matchResult({...match, winner_side: null}, 'linked')).toBe('Result pending')
    expect(matchResult({...match, winner_side: 'unknown'}, 'linked')).toBe('Result pending')
    expect(matchResult({...match, match_players: [{player_id: 'linked', side: null}]}, 'linked')).toBe('Result pending')
  })
  it('preserves calendar dates rather than shifting into the previous day', () => {
    expect(matchDate('2026-10-23')).toBe(matchDate('2026-10-23T00:00:00Z'))
    expect(matchDate(null)).toBe('Date unavailable')
    expect(matchDate('bad date')).toBe('Date unavailable')
    expect(matchDate('2026-02-30')).toBe('Date unavailable')
  })
})
