import { describe, expect, it } from 'vitest'
import { currentSeasonReplies, mergeSeasonLineupAnswers, seasonFixtures, seasonInviteText, seasonReadiness, seasonMatchLabel, type SeasonReply, type SeasonScope } from '../season-kickoff'
import type { TeamSeasonMatch } from '../team-season-calendar'

const scope: SeasonScope = { team: 'Aces', league: '2027 Fall', flight: '4.0', seasonKey: JSON.stringify(['2027', '2027 Fall', '4.0']) }
const match: TeamSeasonMatch = { id: 'match-1', league_name: scope.league, flight: scope.flight, home_team: 'Aces', away_team: 'Volleys', match_date: '2026-09-14', match_time: '18:00:00' }
const reply: SeasonReply = { match_id: match.id, invite_id: 'player-1', match_date: match.match_date!, match_time: '18:00:00', status: 'available' }
describe('season kickoff integrity', () => {
  it('shows readable dates and times without guessing missing times', () => {
    expect(seasonMatchLabel(match)).toBe('Mon, Sep 14, 2026 · 6:00 PM')
    expect(seasonMatchLabel({ ...match, match_time: null })).toContain('Time TBD')
  })
  it('keeps a named season across calendar years and rejects other teams, flights, seasons, courts and cancelled dates', () => {
    const rows = [match, { ...match, id: 'next-year', match_date: '2027-01-04' }, { ...match, id: 'other-team', home_team: 'Smash' }, { ...match, id: 'other-flight', flight: '4.5' }, { ...match, id: 'other-season', league_name: '2026 Fall' }, { ...match, id: 'court', line_number: '1' }, { ...match, id: 'cancelled', status: 'cancelled' }]
    expect(seasonFixtures(scope, rows).map(row => row.id)).toEqual(['match-1', 'next-year'])
  })
  it('does not confuse two matches on the same day', () => {
    const matches = [match, { ...match, id: 'match-2', away_team: 'Smash' }]
    const result = seasonReadiness(matches, [{ id: 'player-1', revoked_at: null }], [reply])
    expect(result[0]).toMatchObject({ available: 1, waiting: 0 })
    expect(result[1]).toMatchObject({ available: 0, waiting: 1 })
  })
  it('requires a fresh answer after date or time changes, but not an address update', () => {
    expect(currentSeasonReplies([{ ...match, match_date: '2026-09-15' }], [reply])).toEqual([])
    expect(currentSeasonReplies([{ ...match, match_time: '19:00:00' }], [reply])).toEqual([])
    expect(currentSeasonReplies([{ ...match, facility: 'New courts', match_time: '6:00 PM' }], [reply])).toHaveLength(1)
  })
  it('never treats unanswered or revoked links as Yes', () => {
    const result = seasonReadiness([match], [{ id: 'player-1', revoked_at: '2026-09-07' }, { id: 'player-2', revoked_at: null }], [reply])
    expect(result[0]).toMatchObject({ available: 0, maybe: 0, unavailable: 0, waiting: 1 })
  })
  it('counts not sure separately from unanswered', () => {
    expect(seasonReadiness([match], [{ id: 'player-1', revoked_at: null }], [{ ...reply, status: 'maybe' }])[0]).toMatchObject({ available: 0, maybe: 1, waiting: 0 })
  })
  it('uses the latest reply without turning season availability into final confirmation', () => {
    const base = { id: 'a', player_id: 'p', match_date: '2026-09-14', team_name: 'Aces', league_name: '2027 Fall', flight: '4.0', notes: null }
    const confirmed = { ...base, status: 'available', responded_at: '2026-09-07T12:00:00Z' }
    const seasonNo = { ...base, id: 'b', status: 'unavailable', responded_at: '2026-09-07T13:00:00Z' }
    expect(mergeSeasonLineupAnswers([confirmed, seasonNo])[0].status).toBe('unavailable')
    expect(mergeSeasonLineupAnswers([seasonNo, { ...confirmed, responded_at: '2026-09-07T14:00:00Z' }])[0].status).toBe('available')
    expect(mergeSeasonLineupAnswers([{ ...confirmed, responded_at: null }, { ...seasonNo, status: 'season-available' }])[0].status).toBe('season-available')
  })
  it('explains personal-link and selection boundaries in the invite', () => {
    const text = seasonInviteText('Aces', 'Jordan', 'https://example.test/season#token')
    expect(text).toContain('Jordan')
    expect(text).toContain('No TiQ login needed')
    expect(text).toContain('not a final lineup selection')
  })
})
