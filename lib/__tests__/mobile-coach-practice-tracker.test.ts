import {expect, it} from 'vitest'
import type {CoachAssignment} from '../coach-storage'
import {coachSnapshot} from '../../tests/fixtures/native-coach'
import {coachPracticeCounts, filterCoachPractice} from '../../mobile/src/coach-practice-tracker'

const source = coachSnapshot('student-one').detail!.assignments[0]
const assignment = (id: string, status: CoachAssignment['status'], extra: Partial<CoachAssignment> = {}): CoachAssignment =>
  ({...source, id, status, assignment: {}, ...extra})
const checkedIn = (date: string) => ({playerCheckIn: {recap: 'Kept returns deep.', evidence: '8/10', completedAt: date}})
const rows = [
  assignment('later-check-in', 'completed', {assignment: checkedIn('2026-11-17T12:00:00Z')}),
  assignment('older-check-in', 'completed', {assignment: checkedIn('2026-11-12T12:00:00Z')}),
  assignment('reviewed', 'completed', {assignment: {...checkedIn('2026-11-13T12:00:00Z'), coachReview: {note: 'Earlier split step.', nextFocus: '', reviewedAt: '2026-11-14T12:00:00Z'}}}),
  assignment('recorded-complete', 'completed'),
  assignment('archived-proof', 'archived', {assignment: checkedIn('2026-11-01T12:00:00Z')}),
  assignment('assigned-no-date', 'assigned', {dueDate: null}),
  assignment('assigned-later', 'assigned', {dueDate: '2026-11-30'}),
  assignment('assigned-overdue', 'assigned', {dueDate: '2026-11-10'}),
  assignment('draft', 'draft'),
]

it('counts actual assigned work and completed check-ins without treating archived proof as waiting feedback', () => {
  expect(coachPracticeCounts(rows)).toEqual({assigned: 3, review: 2, reviewed: 1})
  expect(filterCoachPractice(rows, {q: '', status: 'review'}).map(a => a.id)).toEqual(['older-check-in', 'later-check-in'])
})

it('places older reviews first and assigned practice in due-date order without changing the saved array', () => {
  const originalOrder = rows.map(a => a.id)
  expect(filterCoachPractice(rows, {q: '', status: 'all'}).slice(0, 5).map(a => a.id))
    .toEqual(['older-check-in', 'later-check-in', 'assigned-overdue', 'assigned-later', 'assigned-no-date'])
  expect(rows.map(a => a.id)).toEqual(originalOrder)
})

it('keeps completed records without player proof findable alongside reviewed work', () => {
  expect(filterCoachPractice(rows, {q: '', status: 'completed'}).map(a => a.id).sort())
    .toEqual(['later-check-in', 'older-check-in', 'recorded-complete', 'reviewed'])
  expect(filterCoachPractice(rows, {q: '', status: 'reviewed'}).map(a => a.id)).toEqual(['reviewed'])
  expect(filterCoachPractice(rows, {q: '', status: 'archived'}).map(a => a.id)).toEqual(['archived-proof'])
})

it('searches title and focus literally with Unicode normalization, independently of private check-in text', () => {
  const practice = assignment('literal', 'assigned', {title: 'Ａｄ-side serve %_ pattern', focus: 'Backhand return'})
  expect(filterCoachPractice([practice], {q: ' ad-SIDE ', status: 'assigned'})).toEqual([practice])
  expect(filterCoachPractice([practice], {q: '%_', status: 'all'})).toEqual([practice])
  expect(filterCoachPractice([practice], {q: 'backHAND', status: 'all'})).toEqual([practice])
  expect(filterCoachPractice(rows, {q: 'Kept returns deep.', status: 'all'})).toEqual([])
  expect(filterCoachPractice([practice], {q: '.*', status: 'all'})).toEqual([])
})

it('uses a stable identifier to resolve equal or missing check-in times', () => {
  const a = assignment('a', 'completed', {assignment: checkedIn('not a timestamp')})
  const b = assignment('b', 'completed', {assignment: checkedIn('not a timestamp')})
  expect(filterCoachPractice([b, a], {q: '', status: 'review'}).map(a => a.id)).toEqual(['a', 'b'])
})
