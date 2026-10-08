import { describe, expect, it } from 'vitest'
import { buildEventCourtQueue } from '../tournament-event-next-on-court'
import type { EventDeskMatch } from '../tournament-event-desk'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const divisions = [{ id: '40', entrants: ['A', 'B', 'C', 'D'] }, { id: '45', entrants: ['E', 'F'] }] as TiqTournamentRecord[]
function match(key: string, extra: Partial<EventDeskMatch> = {}): EventDeskMatch {
 return { key, divisionId: '40', divisionName: '4.0', matchId: key, label: key, sideA: 'A', sideB: 'B', date: '2026-10-17', time: '17:30', court: '1', completed: false, assigned: true, round: 1, ...extra }
}
describe('event-night court queue', () => {
 it('combines court aliases across divisions and advances after a posted result', () => {
  const first = match('first')
  const later = match('later', { divisionId: '45', sideA: 'E', sideB: 'F', court: 'Court 01', time: '18:30' })
  expect(buildEventCourtQueue([later, first], divisions).courts).toMatchObject([{ court: '1', next: { key: 'first' }, remaining: 2 }])
  expect(buildEventCourtQueue([later, { ...first, completed: true }], divisions).courts[0].next.key).toBe('later')
 })
 it('excludes unresolved playoff slots even if scheduled or the format omits a ready flag', () => {
  const result = buildEventCourtQueue([match('playoff', { ready: false }), match('placeholder', { sideA: 'Winner Group A' }), match('real')], divisions)
  expect(result.courts[0].remaining).toBe(1)
  expect(result.awaitingPlayers).toBe(2)
 })
 it('separates unassigned playable matches and preserves chronological order across dates', () => {
  const result = buildEventCourtQueue([match('tomorrow', { date: '2026-10-18', time: '01:00' }), match('tonight', { time: '23:30' }), match('no-slot', { assigned: false, court: '' }), match('done', { completed: true })], divisions)
  expect(result.courts[0].next.key).toBe('tonight')
  expect(result.unassigned.map(row => row.key)).toEqual(['no-slot'])
  expect(result.awaitingPlayers).toBe(0)
 })
})
