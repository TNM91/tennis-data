import { describe, expect, it } from 'vitest'
import { buildTeamSeasonCalendars, type TeamSeasonMatch } from '../team-season-calendar'
import { buildTeamScheduleCalendarItems } from '../team-schedule-calendar'

const fixture: TeamSeasonMatch = { id: 'canonical-1', external_match_id: '1011650666', home_team: 'Aces', away_team: 'Volleys', match_date: '2026-09-14', match_time: '6:00 PM', facility: 'Center Court', league_name: 'Fall', flight: '4.0', match_type: null }

describe('team season calendar', () => {
  it('keeps the same identity as adding the imported schedule, including on retry', () => {
    const items = buildTeamSeasonCalendars('Aces', [fixture, fixture], 'owner')[0].items
    const upload = buildTeamScheduleCalendarItems({ teamName: 'Aces', leagueName: 'Fall', calendarOwnerId: 'owner', matches: [{ externalMatchId: '1011650666', matchDate: '9/14/2026', matchTime: '6:00 PM', homeTeam: 'Aces', awayTeam: 'Volleys', facility: 'Center Court' }] })
    expect(items).toEqual(upload)
    expect(items).toHaveLength(1)
  })
  it('separates seasons and leagues, preserves times/sites, and sorts dates', () => {
    const groups = buildTeamSeasonCalendars('Aces', [fixture, { ...fixture, id: '2', external_match_id: '2', league_name: 'Spring' }, { ...fixture, id: '3', external_match_id: '3', match_date: '2027-01-03' }], 'owner')
    expect(groups).toHaveLength(3)
    expect(groups[0].label).toContain('2027')
    expect(groups[1].items[0]).toMatchObject({ time: '18:00', location: 'Center Court' })
  })
  it('excludes other teams, individual courts, cancelled matches and impossible dates', () => {
    const excluded = [
      { ...fixture, home_team: 'Other' },
      { ...fixture, match_type: 'doubles' },
      { ...fixture, line_number: '1' },
      { ...fixture, status: 'cancelled' },
      { ...fixture, match_date: '2026-02-30' },
      { ...fixture, match_date: '2026-99-01' },
      { ...fixture, match_date: null },
    ]
    expect(buildTeamSeasonCalendars('Aces', excluded, 'owner')).toEqual([])
  })
  it('keeps all-day matches without inventing a time and scopes IDs to the account', () => {
    const row = { ...fixture, match_time: null }
    const a = buildTeamSeasonCalendars('Aces', [row], 'a')[0].items[0]
    const b = buildTeamSeasonCalendars('Aces', [row], 'b')[0].items[0]
    expect(a.time).toBe('')
    expect(a.id).not.toBe(b.id)
  })
})
