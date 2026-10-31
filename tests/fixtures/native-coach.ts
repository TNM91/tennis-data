import type {NativeCoachSnapshot, CoachCreate, CoachReview} from '../../lib/native-coach-contract'
export const coachOwner = '11111111-1111-4111-8111-111111111111'
export const coachRevision = '2026-10-30T12:00:00.123456+00:00'
export function coachSnapshot(selected = ''): NativeCoachSnapshot {
  const student = {id: 'student-one', name: 'Alex Rivera', level: '4.0', identity: 'relentless-competitor-4-0', status: 'active' as const, linked: true, notes: 'Work on the second-serve return.', updatedAt: coachRevision}
  return {owner: coachOwner, checkedAt: '2026-10-30T13:00:00Z', students: [student], moreStudents: false, detail: selected ? {student, moreAssignments: false, assignments: [{id: 'assignment-one', studentLinkId: student.id, title: 'Deep return under pressure', focus: 'Second-serve return', dueDate: '2026-11-05', status: 'completed', assignment: {detail: 'Split step and send five returns past the service line.', expectedEvidence: 'Five deep returns', futureField: 'preserve', playerCheckIn: {recap: 'Four of five returns stayed deep.', evidence: '4/5', completedAt: '2026-10-30T12:00:00Z'}}, updatedAt: coachRevision}]} : null}
}
export const coachStudentDraft: CoachCreate = {kind: 'student', id: '44444444-4444-4444-8444-444444444444', name: 'Taylor Chen', level: '3.5', notes: 'Build a reliable second serve.'}
export const coachAssignmentDraft: CoachCreate = {kind: 'assignment', id: '55555555-5555-4555-8555-555555555555', student: 'student-one', expectedUpdatedAt: coachRevision, title: 'Serve plus one', focus: 'First ball', dueDate: null, instructions: 'Hit five wide serves, then a deep forehand.', evidence: 'Five patterns', status: 'assigned'}
export const coachReviewDraft: CoachReview = {id: 'assignment-one', student: 'student-one', expectedUpdatedAt: coachRevision, note: 'Keep the split step earlier.', nextFocus: 'Return depth'}
