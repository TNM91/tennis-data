import type {SupabaseClient} from '@supabase/supabase-js'
import {expect, it, vi} from 'vitest'
import {loadCoachWorkspace, saveCoachWorkspace, coachWriteMatches, CoachWorkspaceError, type CoachSend} from '../../mobile/src/coach-workspace-data'
import {coachOwner, coachSnapshot, coachAssignmentDraft, coachReviewDraft} from '../../tests/fixtures/native-coach'
function account() {return {auth: {getSession: vi.fn(async () => ({data: {session: {user: {id: coachOwner}, access_token: 'synthetic-coach-token'}}, error: null}))}} as unknown as SupabaseClient}
const reply = (selected = '') => ({status: 200, headers: {}, url: 'https://www.tenaceiq.com/api/mobile/coach', data: {ok: true, ...coachSnapshot(selected)}})
it('uses current bearer authentication and bounded private requests', async () => {
 const send = vi.fn<CoachSend>().mockResolvedValue(reply('student-one'))
 await loadCoachWorkspace(account(), coachOwner, () => true, 'student-one', send)
 expect(send).toHaveBeenCalledExactlyOnceWith('GET', expect.objectContaining({url: 'https://www.tenaceiq.com/api/mobile/coach?student=student-one', headers: expect.objectContaining({Authorization: 'Bearer synthetic-coach-token', 'Cache-Control': 'no-store'}), disableRedirects: true, readTimeout: 30000}))
})
it('rejects stale sessions before and after transport, including switched accounts', async () => {
 const send = vi.fn<CoachSend>().mockResolvedValue(reply()), client = account()
 await expect(loadCoachWorkspace(client, 'other', () => true, '', send)).rejects.toThrow(); expect(send).not.toHaveBeenCalled()
 let valid = true
 send.mockImplementation(async () => {valid = false; return reply()})
 await expect(loadCoachWorkspace(client, coachOwner, () => valid, '', send)).rejects.toThrow()
})
it('rejects foreign-owner confirmations and membership rejection', async () => {
 const send = vi.fn<CoachSend>().mockResolvedValue({...reply(), data: {...reply().data, owner: 'other'}})
 await expect(loadCoachWorkspace(account(), coachOwner, () => true, '', send)).rejects.toThrow()
 send.mockResolvedValue({...reply(), status: 403})
 await expect(loadCoachWorkspace(account(), coachOwner, () => true, '', send)).rejects.toMatchObject({status: 403})
})
it('never retries an uncertain mutation automatically; explicit recovery reads saved work', async () => {
 const saved = coachSnapshot('student-one'), draft = coachAssignmentDraft
 if (draft.kind !== 'assignment') throw Error('Fixture mismatch')
 saved.detail!.assignments.push({id: draft.id, studentLinkId: draft.student, title: draft.title, focus: draft.focus, dueDate: draft.dueDate, status: draft.status, assignment: {detail: draft.instructions, expectedEvidence: draft.evidence}, updatedAt: '2026-10-30T15:00:00Z'})
 const send = vi.fn<CoachSend>().mockRejectedValueOnce(Error('Lost response')).mockResolvedValue({...reply('student-one'), data: {ok: true, ...saved}})
 await expect(saveCoachWorkspace(account(), coachOwner, () => true, draft, false, send)).rejects.toThrow('Lost response')
 expect(send).toHaveBeenCalledTimes(1)
 expect((await saveCoachWorkspace(account(), coachOwner, () => true, draft, true, send)).confirmed).toBe(true)
 expect(send.mock.calls.map(c => c[0])).toEqual(['POST', 'GET'])
})
it('requires the exact intended review, preserving newer unrelated changes', async () => {
 const snapshot = coachSnapshot('student-one'), a = snapshot.detail!.assignments[0]
 expect(coachWriteMatches(snapshot, coachReviewDraft)).toBe(false)
 a.assignment.coachReview = {note: coachReviewDraft.note, nextFocus: coachReviewDraft.nextFocus, reviewedAt: '2026-10-30T15:00:00Z'}
 expect(coachWriteMatches(snapshot, coachReviewDraft)).toBe(false)
 a.updatedAt = '2026-10-30T15:00:00Z'; expect(coachWriteMatches(snapshot, coachReviewDraft)).toBe(true)
 a.assignment.coachReview = {...a.assignment.coachReview as object, note: 'Another coach update'}
 expect(coachWriteMatches(snapshot, coachReviewDraft)).toBe(false)
})
it('exposes actionable conflicts without an implicit retry', async () => {
 const send = vi.fn<CoachSend>().mockResolvedValue({...reply('student-one'), status: 409})
 await expect(saveCoachWorkspace(account(), coachOwner, () => true, coachReviewDraft, false, send)).rejects.toBeInstanceOf(CoachWorkspaceError)
 expect(send).toHaveBeenCalledTimes(1)
})
