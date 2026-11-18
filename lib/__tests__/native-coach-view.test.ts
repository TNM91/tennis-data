import {it, expect} from 'vitest'
import {coachAssignmentHtml} from '../../mobile/src/coach-workspace-view'
import {coachSnapshot} from '../../tests/fixtures/native-coach'
import {coachReviewQueue, coachReviewQueueHtml} from '../../mobile/src/coach-review-queue'
it('renders player evidence as text and omits unrelated assignment metadata', () => {
 const a = coachSnapshot('student-one').detail!.assignments[0]
 a.title = '<img src=x onerror=alert(1)>'
 a.assignment.futurePrivateField = 'not-for-display'
 a.assignment.playerCheckIn = {recap: '<script>attack</script>', evidence: '4/5', completedAt: '2026-10-30T12:00:00Z'}
 const markup = coachAssignmentHtml(a)
 expect(markup).toContain('&lt;img'); expect(markup).toContain('&lt;script&gt;')
 expect(markup).not.toContain('<script>'); expect(markup).not.toContain('<img '); expect(markup).not.toContain('not-for-display')
 expect(markup).toContain('4/5')
})

it('reviews the oldest check-in first even when its assignment was edited later', () => {
 const next = coachSnapshot('student-one').detail!.assignments[0]
 const older = {...next, id: 'older', updatedAt: '2026-11-10T00:00:00Z', assignment: {...next.assignment,
  playerCheckIn: {recap: 'Earlier practice', evidence: '8/10', completedAt: '2026-10-29T12:00:00Z'}}}
 const rows = [next, older], before = JSON.stringify(rows)
 expect(coachReviewQueue(rows).map(row => row.id)).toEqual(['older', next.id])
 expect(JSON.stringify(rows)).toBe(before)
})

it('excludes drafts, incomplete work, archived proof and check-ins that already have feedback', () => {
 const next = coachSnapshot('student-one').detail!.assignments[0]
 const rows = [next, {...next, id: 'reviewed', assignment: {...next.assignment, coachReview: {note: 'Reviewed', nextFocus: 'Depth'}}},
  {...next, id: 'no-check-in', assignment: {}}, ...(['assigned', 'draft', 'archived'] as const).map(status => ({...next, id: status, status}))]
 expect(coachReviewQueue(rows).map(row => row.id)).toEqual([next.id])
 expect(coachReviewQueueHtml(rows.slice(1))).toBe('')
})

it('places undated check-ins last and breaks date ties consistently', () => {
 const next = coachSnapshot('student-one').detail!.assignments[0]
 const undated = (id: string) => ({...next, id, assignment: {...next.assignment, playerCheckIn: {recap: 'Practice', completedAt: 'unavailable'}}})
 expect(coachReviewQueue([undated('z'), {...next, id: 'b'}, undated('x'), {...next, id: 'a'}]).map(row => row.id)).toEqual(['a', 'b', 'x', 'z'])
})

it('escapes the review preview, omits unrelated metadata and labels a partial assignment list', () => {
 const next = coachSnapshot('student-one').detail!.assignments[0]
 next.title = '<img src=x>'
 next.assignment = {...next.assignment, futurePrivateField: 'not-for-preview',
  playerCheckIn: {recap: '<script>attack</script>', completedAt: '2026-10-30T12:00:00Z'}}
 const markup = coachReviewQueueHtml([next], true)
 expect(markup).toContain('1 awaiting feedback in the latest 100 assignments')
 expect(markup).toContain('&lt;img'); expect(markup).toContain('&lt;script&gt;')
 expect(markup).not.toContain('<img '); expect(markup).not.toContain('<script>')
 expect(markup).not.toContain('not-for-preview')
})
