import {expect, it, vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {coachInvitationsRequest, shareCoachInvitation} from '../../mobile/src/coach-invites-data'
import type {CoachSend} from '../../mobile/src/coach-workspace-data'
import {coachOwner, coachRevision} from '../../tests/fixtures/native-coach'
import {readCoachInvitations, type CoachInvitations, type CoachInviteIntent} from '../native-coach-invite-contract'
const client = {auth: {getSession: async () => ({data: {session: {user: {id: coachOwner}, access_token: 'synthetic-token'}}, error: null})}} as unknown as SupabaseClient
const snapshot = (): CoachInvitations => ({owner: coachOwner, student: {id: 'student-one', name: 'Taylor Chen', linked: false, paused: false, updatedAt: coachRevision}, invites: [{id: 'invite-one', student: 'student-one', email: 'player@example.test', message: 'Hello', status: 'pending', expiresAt: '2030-01-01T00:00:00Z', updatedAt: coachRevision, href: 'https://www.tenaceiq.com/coach/invite/synthetic-token'}], more: false})
const response = () => ({status: 200, headers: {}, url: 'https://www.tenaceiq.com/api/mobile/coach/invites', data: {ok: true, ...snapshot()}})
it('checks owner before and after private bounded transport', async () => {
 const send = vi.fn<CoachSend>().mockResolvedValue(response())
 await expect(coachInvitationsRequest(client, 'other', () => true, 'student-one', null, send)).rejects.toThrow(); expect(send).not.toHaveBeenCalled()
 await coachInvitationsRequest(client, coachOwner, () => true, 'student-one', null, send); expect(send).toHaveBeenCalledWith('GET', expect.objectContaining({disableRedirects: true, readTimeout: 30000, headers: expect.objectContaining({Authorization: 'Bearer synthetic-token'})}))
 let valid = true; send.mockImplementation(async () => {valid = false; return response()}); await expect(coachInvitationsRequest(client, coachOwner, () => valid, 'student-one', null, send)).rejects.toThrow()
})
it('does not retry a lost create confirmation or accept the wrong operation receipt', async () => {
 const intent: CoachInviteIntent = {action: 'create', id: '66666666-6666-4666-8666-666666666666', student: 'student-one', expectedUpdatedAt: coachRevision, email: 'player@example.test', message: 'Hello'}
 const send = vi.fn<CoachSend>().mockRejectedValueOnce(Error('Lost')).mockResolvedValue(response())
 await expect(coachInvitationsRequest(client, coachOwner, () => true, 'student-one', intent, send)).rejects.toThrow('Lost'); expect(send).toHaveBeenCalledTimes(1)
 await expect(coachInvitationsRequest(client, coachOwner, () => true, 'student-one', intent, send)).rejects.toThrow()
})
it('rechecks current status, revision, email, connection and account before sharing or copying', async () => {
 for (const change of ['revoked', 'expired', 'revision', 'email', 'linked', 'account']) {
  const old = snapshot().invites[0], fresh = snapshot(), share = vi.fn(), copy = vi.fn()
  if (change === 'revoked') fresh.invites[0].status = 'revoked'
  if (change === 'expired') fresh.invites[0].expiresAt = '2020-01-01T00:00:00Z'
  if (change === 'revision') fresh.invites[0].updatedAt = '2030-01-01T00:00:00Z'
  if (change === 'email') fresh.invites[0].email = 'other@example.test'
  if (change === 'linked') fresh.student.linked = true
  if (change === 'account') await expect(shareCoachInvitation(old, async () => fresh, () => false, true, share, copy)).rejects.toThrow()
  else expect((await shareCoachInvitation(old, async () => fresh, () => true, true, share, copy)).done).toBe(false)
  expect(share).not.toHaveBeenCalled(); expect(copy).not.toHaveBeenCalled()
 }
 const s = snapshot(), share = vi.fn(), copy = vi.fn(); expect((await shareCoachInvitation(s.invites[0], async () => s, () => true, true, share, copy)).done).toBe(true); expect(copy).toHaveBeenCalledWith({string: s.invites[0].href})
})
it('rejects foreign selections and arbitrary invitation URLs before display', () => {
 for (const href of ['https://evil.example/link', 'javascript:alert(1)', 'https://www.tenaceiq.com/coach/invite/a?token=b']) {const s = snapshot(); s.invites[0].href = href; expect(() => readCoachInvitations({ok: true, ...s}, coachOwner, 'student-one')).toThrow()}
 expect(() => readCoachInvitations({ok: true, ...snapshot()}, coachOwner, 'other')).toThrow()
})
