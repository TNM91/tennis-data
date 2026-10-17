import { describe, expect, it } from 'vitest'
import { mergeCaptainMatchResponses } from '../captain-match-responses'

const scope = { team: 'Meinert', league: 'Fall', flight: '4.5', date: '2026-10-18' }
const invites = [{ player_id: 'player-1', player_name: 'Nathan' }]
const availability = { team_name: 'Meinert', league_name: 'Fall', flight: '4.5', match_date: scope.date, player_id: 'player-1', status: 'available', notes: 'Confirmed by captain.' }
const reply = { player_id: 'player-1', player_name: 'Nathan', match_date: scope.date, status: 'maybe', notes: null, responded_at: '2026-10-16T12:00:00Z' }

describe('shared captain match responses', () => {
  it('includes a captain-recorded confirmation without a link reply', () => {
    expect(mergeCaptainMatchResponses(scope, invites, [], [availability])).toEqual([
      { player_id: 'player-1', player_name: 'Nathan', match_date: scope.date, status: 'available', notes: 'Confirmed by captain.', responded_at: null },
    ])
  })
  it('uses the current match record over an older link reply without duplicating the player', () => {
    const result = mergeCaptainMatchResponses(scope, invites, [reply], [availability])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ status: 'available', responded_at: reply.responded_at })
  })
  it.each([['unavailable', 'unavailable'], ['limited', 'maybe']])('preserves %s instead of confirming the player', (status, expected) => {
    expect(mergeCaptainMatchResponses(scope, invites, [], [{ ...availability, status }])[0].status).toBe(expected)
  })
  it.each([{ team_name: 'Other' }, { league_name: 'Spring' }, { flight: '3.5' }, { match_date: '2026-10-25' }])('excludes a different match scope %j', (different) => {
    expect(mergeCaptainMatchResponses(scope, invites, [], [{ ...availability, ...different }])).toEqual([])
  })
  it('keeps a name-only response when no canonical player record exists', () => {
    const response = { ...reply, player_id: null }
    expect(mergeCaptainMatchResponses(scope, invites, [response], [])).toEqual([response])
  })
  it('replaces a name-only reply when the same invited player has a stable ID', () => {
    expect(mergeCaptainMatchResponses(scope, invites, [{ ...reply, player_id: null }], [availability])).toHaveLength(1)
  })
  it('does not invent a reply for unknown or unanswered players', () => {
    expect(mergeCaptainMatchResponses(scope, invites, [], [{ ...availability, status: null }])).toEqual([])
    expect(mergeCaptainMatchResponses(scope, [], [], [availability])).toEqual([])
  })
  it('retains the latest link reply when multiple replies are provided newest first', () => {
    expect(mergeCaptainMatchResponses(scope, invites, [reply, { ...reply, status: 'available' }], [])[0].status).toBe('maybe')
  })
})
