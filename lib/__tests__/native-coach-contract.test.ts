import {expect, it} from 'vitest'
import {readNativeCoach, readCoachCreate, readCoachReview} from '../native-coach-contract'
import {coachOwner, coachSnapshot, coachStudentDraft, coachAssignmentDraft, coachReviewDraft} from '../../tests/fixtures/native-coach'
it('bounds and sanitizes coach snapshots without private account/contact fields', () => {
 const raw = {...coachSnapshot('student-one'), ok: true, contact: 'private'}
 const snapshot = readNativeCoach(raw, coachOwner, 'student-one')
 expect(snapshot.detail?.assignments[0].updatedAt).toBe(coachReviewDraft.expectedUpdatedAt)
 expect(snapshot).not.toHaveProperty('contact')
 for (const patch of [{owner: 'other'}, {students: Array(101).fill(raw.students[0])}, {students: [raw.students[0], raw.students[0]]}, {checkedAt: 'bad'}]) expect(() => readNativeCoach({...raw, ...patch}, coachOwner, 'student-one')).toThrow()
 expect(() => readNativeCoach(raw, coachOwner, 'other')).toThrow()
 expect(() => readNativeCoach({...raw, detail: {...raw.detail, assignments: [{...raw.detail!.assignments[0], studentLinkId: 'other'}]}}, coachOwner, 'student-one')).toThrow()
})
it('rejects unknown fields, invalid dates, oversized notes and unreviewed status changes', () => {
 expect(readCoachCreate(coachStudentDraft)).toEqual(coachStudentDraft)
 expect(readCoachCreate(coachAssignmentDraft)).toEqual(coachAssignmentDraft)
 expect(readCoachReview(coachReviewDraft)).toEqual(coachReviewDraft)
 for (const draft of [{...coachStudentDraft, owner: 'other'}, {...coachStudentDraft, playerUserId: 'someone'}, {...coachStudentDraft, name: ''}, {...coachStudentDraft, id: 'not-a-new-uuid'}, {...coachAssignmentDraft, dueDate: '2026-02-30'}, {...coachAssignmentDraft, status: 'completed'}, {...coachAssignmentDraft, instructions: 'x'.repeat(2001)}]) expect(() => readCoachCreate(draft)).toThrow()
 for (const draft of [{...coachReviewDraft, note: '', nextFocus: ''}, {...coachReviewDraft, expectedUpdatedAt: 'bad'}, {...coachReviewDraft, status: 'completed'}, {...coachReviewDraft, note: 'x'.repeat(701)}]) expect(() => readCoachReview(draft)).toThrow()
})
