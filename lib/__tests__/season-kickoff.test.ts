import { describe, expect, it } from 'vitest'
import { currentSeasonReplies, mergeSeasonLineupAnswers, seasonFixtures, seasonInviteText, seasonReadiness, seasonRosterProgress, seasonMatchLabel, type SeasonInvite, type SeasonReply, type SeasonScope } from '../season-kickoff'
import type { TeamSeasonMatch } from '../team-season-calendar'

const scope: SeasonScope = { team: 'Aces', league: '2027 Fall', flight: '4.0', seasonKey: JSON.stringify(['2027', '2027 Fall', '4.0']) }
const match: TeamSeasonMatch = { id: 'match-1', league_name: scope.league, flight: scope.flight, home_team: 'Aces', away_team: 'Volleys', match_date: '2026-09-14', match_time: '18:00:00' }
const reply: SeasonReply = { match_id: match.id, invite_id: 'player-1', match_date: match.match_date!, match_time: '18:00:00', status: 'available' }
describe('season kickoff integrity', () => {
  const roster = Array.from({ length: 10 }, (_, i) => ({ key: `p${i}`, playerId: `p${i}`, name: `Player ${i}` }))
  const invite: SeasonInvite = { id: 'player-1', roster_key: 'p0', player_id: 'p0', player_name: 'Player 0', response_token: 'secret', revoked_at: null, match_ids: [match.id] }
  it('accounts for all ten players when only one has been invited', () => {
    const progress = seasonRosterProgress([match], roster, [invite], [])
    expect(progress).toMatchObject({ started: 0, complete: 0, needsInvite: 9 })
    expect(progress.matches[0]).toMatchObject({ available: 0, waiting: 1, needsInvite: 9 })
  })
  it('updates team totals from a saved personal reply without treating missing players as Yes', () => {
    const progress = seasonRosterProgress([match], roster, [invite], [reply])
    expect(progress).toMatchObject({ started: 1, complete: 1, needsInvite: 9 })
    expect(progress.matches[0]).toMatchObject({ available: 1, waiting: 0, needsInvite: 9 })
  })
  it('excludes stopped links, removed players, stale fixtures and answers outside the invitation', () => {
    expect(seasonRosterProgress([match], roster, [{ ...invite, revoked_at: 'stopped' }], [reply]).matches[0]).toMatchObject({ available: 0, waiting: 0, needsInvite: 10 })
    expect(seasonRosterProgress([match], roster.slice(1), [invite], [reply]).started).toBe(0)
    expect(seasonRosterProgress([{ ...match, match_time: '19:00' }], roster, [invite], [reply]).matches[0]).toMatchObject({ available: 0, waiting: 1 })
    expect(seasonRosterProgress([match], roster, [{ ...invite, match_ids: [] }], [reply]).matches[0]).toMatchObject({ available: 0, waiting: 1 })
  })
  it('does not mark the roster complete for an empty season or an unanswered doubleheader', () => {
    expect(seasonRosterProgress([], roster, [invite], []).complete).toBe(0)
    expect(seasonRosterProgress([match, { ...match, id: 'second' }], roster, [invite], [reply])).toMatchObject({ started: 1, complete: 0 })
  })
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
