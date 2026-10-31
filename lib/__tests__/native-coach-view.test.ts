import {it, expect} from 'vitest'
import {coachAssignmentHtml} from '../../mobile/src/coach-workspace-view'
import {coachSnapshot} from '../../tests/fixtures/native-coach'
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
