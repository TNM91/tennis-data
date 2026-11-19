import {describe, expect, it} from 'vitest'
import type {MatchLineupCourt, SavedTeamLineup} from '../team-match-lineup-contract'
import type {TeamMatchReplies} from '../team-match-replies-contract'
import {ownSharedCourtHtml, teamMatchReadiness, teamReadinessHtml} from '../../mobile/src/team-match-readiness'

const replies = (): TeamMatchReplies => ({own: null, team: [], awaiting: ['Blair'], rosterComplete: true,
 lineupRoster: [{id: 'a', name: '<Alex>', choice: 'in'}, {id: 'b', name: 'Blair', choice: null},
  {id: 'c', name: 'Casey', choice: 'maybe'}, {id: 'd', name: 'Drew', choice: 'out'}]})

describe('first-party team match readiness', () => {
 it('counts open seats, duplicates and assigned availability separately without inventing a full match format', () => {
  const courts: MatchLineupCourt[] = [{format: 'doubles', players: ['a', '']}, {format: 'singles', players: ['a']},
   {format: 'doubles', players: ['c', 'missing']}, {format: 'singles', players: ['d']}]
  expect(teamMatchReadiness(courts, replies())).toEqual({seats: 6, filled: 5, open: 1, duplicates: 1, confirmed: 1,
   awaiting: 1, complete: true, hasLineup: true, attention: [
    {id: 'c', name: 'Casey', reason: 'Maybe'}, {id: 'missing', name: 'Player no longer on roster', reason: 'No longer on roster'},
    {id: 'd', name: 'Drew', reason: 'Can’t play'}]})
 })
 it('does not count unknown or name-matched replies as confirmed', () => {
  const courts: MatchLineupCourt[] = [{format: 'singles', players: ['a']}]
  expect(teamMatchReadiness(courts, null).confirmed).toBeNull()
  expect(teamMatchReadiness(courts, {own: null, team: [{name: '<Alex>', choice: 'in'}]}).confirmed).toBeNull()
  expect(teamReadinessHtml(null, courts)).toContain('Not checked')
  const partial = {...replies(), rosterComplete: false}
  expect(teamReadinessHtml(partial, courts)).toContain('teammates loaded here')
  expect(teamMatchReadiness([{format:'singles',players:['missing']}],partial).attention[0].reason).toBe('Not in loaded roster')
 })
 it('keeps unanswered selected players visible and distinguishes no plan from zero confirmed players', () => {
  expect(teamMatchReadiness([{format: 'singles', players: ['b']}], replies()).attention).toEqual([
   {id: 'b', name: 'Blair', reason: 'Awaiting reply'}])
  expect(teamReadinessHtml(replies(), undefined)).toContain('Not planned')
  expect(teamReadinessHtml(replies(), undefined)).not.toContain('0 of 0')
  expect(teamReadinessHtml(replies(), [{format: 'singles', players: ['d']}])).toContain('0 of 1')
 })
 it('escapes roster text and action labels, and renders only captain-supplied shared assignments', () => {
  const data = replies(); data.lineupRoster![0].choice = 'maybe'
  const markup = teamReadinessHtml(data, [{format: 'singles', players: ['a']}], false, [{key: 'lineup', label: '<Review>'}])
  expect(markup).toContain('&lt;Alex&gt;'); expect(markup).toContain('&lt;Review&gt;'); expect(markup).not.toContain('<Alex>')
  const lineup: SavedTeamLineup = {version: 'v', courts: [{format: 'doubles', players: ['a', 'b']}], names: {a: 'Alex', b: '<Blair>'}}
  expect(ownSharedCourtHtml(lineup, 'a')).toBe('')
  const shared = {...lineup, tactics: {board: {}, reference: {}}} as SavedTeamLineup
  expect(ownSharedCourtHtml(shared, 'a')).toContain('Doubles 1')
  expect(ownSharedCourtHtml(shared, 'a')).toContain('Partner · &lt;Blair&gt;')
  expect(ownSharedCourtHtml(shared, 'other')).toContain('You don’t have a court assignment')
 })
})
