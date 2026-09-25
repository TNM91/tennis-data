import { describe, expect, it } from 'vitest'
import { buildProfileTeamSummaries, type ProfileMatchContextRow } from '../profile-team-context'

const match = {
  id: 'match-1',
  flight: '4.0',
  league_name: 'Spring League',
  home_team: 'North Aces',
  away_team: 'South Spins',
}

describe('profile team context', () => {
  it('uses the selected player’s match side and deduplicates the same team', () => {
    const rows: ProfileMatchContextRow[] = [
      { side: 'A', matches: match },
      { side: 'A', matches: [{ ...match, id: 'match-2' }] },
      { side: 'B', matches: match },
    ]

    expect(buildProfileTeamSummaries(rows).map(({ name, league, flight }) => ({ name, league, flight }))).toEqual([
      { name: 'North Aces', league: 'Spring League', flight: '4.0' },
      { name: 'South Spins', league: 'Spring League', flight: '4.0' },
    ])
  })

  it('ignores missing matches and unknown sides', () => {
    expect(buildProfileTeamSummaries([
      { side: 'A', matches: null },
      { side: null, matches: match },
      { side: 'X', matches: match },
    ])).toEqual([])
  })
})
