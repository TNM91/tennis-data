import { describe, expect, it } from 'vitest'
import { teamRosterForSeason, teamSeasonYear, teamSeasonYears } from '../team-season-scope'

const league = '2027 Adult 18 & Over Fall'
const flight = 'Men 4.5 (F)'
const roster = Array.from({ length: 18 }, (_, index) => ({ id: index, league_name: league, flight }))
const old = { id: 100, league_name: '2026 Adult 18 & Over Fall', flight }
const otherFlight = { id: 101, league_name: league, flight: 'Men 4.0 (F)' }

describe('team season roster scope', () => {
  it('shows all 18 imported Hodge players before any match has been played', () => {
    expect(teamRosterForSeason(roster, [], { season: '2027', league, flight })).toEqual(roster)
    expect(teamSeasonYears(roster)).toEqual(['2027'])
  })

  it('keeps years, leagues, and flights isolated, including the all-seasons view', () => {
    const rows = [...roster, old, otherFlight]
    expect(teamRosterForSeason(rows, [], { season: '2026' })).toEqual([old])
    expect(teamRosterForSeason(rows, [], { season: '2027', league, flight })).toEqual(roster)
    expect(teamRosterForSeason(rows, [], { season: 'all', league, flight })).toEqual(roster)
    expect(teamRosterForSeason(rows, [], { season: '2028' })).toEqual([])
    expect(teamRosterForSeason(rows, [], { season: 'all' })).toEqual(rows)
  })

  it('keeps a named championship season together across calendar years', () => {
    const matches = [{ league_name: league, flight, match_date: '2026-10-18' }, { league_name: league, flight, match_date: '2027-01-10' }]
    expect(matches.map(teamSeasonYear)).toEqual(['2027', '2027'])
    expect(teamSeasonYears([...matches, ...roster, old])).toEqual(['2027', '2026'])
    expect(teamSeasonYears([...matches, ...roster, old], { league, flight })).toEqual(['2027'])
  })

  it('falls back to match dates only when the league has no named year', () => {
    expect(teamSeasonYear({ league_name: 'Local league', match_date: '2026-10-18' })).toBe('2026')
    expect(teamSeasonYear({ league_name: null, match_date: 'not a date' })).toBeNull()
    expect(teamSeasonYear({ league_name: league, match_date: null })).toBe('2027')
  })

  it('uses unambiguous match context for undated rosters and refuses reused-season guesses', () => {
    const rows = [{ league_name: 'Local league', flight }]
    const matches = [{ league_name: 'Local league', flight, match_date: '2026-10-18' }]
    expect(teamRosterForSeason(rows, matches, { season: '2026' })).toEqual(rows)
    expect(teamRosterForSeason(rows, matches, { season: '2027' })).toEqual([])
    expect(teamRosterForSeason(rows, [...matches, { ...matches[0], match_date: '2025-10-18' }], { season: '2026' })).toEqual([])
    expect(teamRosterForSeason(rows, [], { season: '2026' })).toEqual([])
    expect(teamRosterForSeason(rows, [], { season: 'all' })).toEqual(rows)
  })

  it('does not assign an undated roster from another flight to a season', () => {
    expect(teamRosterForSeason([{ league_name: 'Local league', flight }], [{ league_name: 'Local league', flight: 'Men 4.0 (F)', match_date: '2026-10-18' }], { season: '2026' })).toEqual([])
  })
})
