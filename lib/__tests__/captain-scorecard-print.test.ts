import { describe, expect, it } from 'vitest'
import { getScorecardRosterNames, type ScorecardRosterRow } from '@/lib/captain-scorecard-print'

const scope = { team: 'Meinert/The Other Guys (F)', league: '2026 Adult Spring', flight: '4.0 Men' }
function row(team: string, player: string, overrides: Partial<ScorecardRosterRow> = {}): ScorecardRosterRow {
  return { team_name: team, player_name: player, league_name: scope.league, flight: scope.flight, ...overrides }
}
describe('printed scorecard roster scope', () => {
  it('separates captain and opponent names from the combined lineup response', () => {
    const rows = [row(scope.team, 'Nathan Meinert'), row('Levin-Malpartida (F)', 'Aaron Levin'), row('Another Scheduled Opponent', 'Wrong Player')]
    expect(getScorecardRosterNames(rows, scope)).toEqual(['Nathan Meinert'])
    expect(getScorecardRosterNames(rows, { ...scope, team: 'Levin-Malpartida (F)' })).toEqual(['Aaron Levin'])
  })
  it('excludes other seasons and flights for the same named team', () => {
    const rows = [row(scope.team, 'Current Player'), row(scope.team, 'Prior Season', { league_name: '2025 Adult Spring' }), row(scope.team, 'Other Flight', { flight: '3.5 Men' })]
    expect(getScorecardRosterNames(rows, scope)).toEqual(['Current Player'])
  })
  it('allows an omitted display suffix without combining different suffixed teams', () => {
    expect(getScorecardRosterNames([row('Meinert/The Other Guys', 'Current Player'), row('Meinert/The Other Guys (A)', 'Other Team')], scope)).toEqual(['Current Player'])
  })
  it('prefers the exact team and deduplicates names case-insensitively', () => {
    expect(getScorecardRosterNames([row(scope.team, ' Nathan   Meinert '), row(scope.team, 'nathan meinert'), row('Meinert/The Other Guys', 'Unrelated Import')], scope)).toEqual(['Nathan Meinert'])
  })
  it('leaves an unavailable roster empty instead of guessing from other teams', () => {
    expect(getScorecardRosterNames([row('Other', 'Player')], scope)).toEqual([])
    expect(getScorecardRosterNames([row(scope.team, 'Player')], { ...scope, flight: '' })).toEqual([])
  })
})
