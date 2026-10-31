import {beforeEach, expect, it} from 'vitest'
import {coachDb} from '../../tests/fixtures/coach-db'
import {acceptCoachInvitation} from '../coach-invite-acceptance'
let db: ReturnType<typeof coachDb>
const user = {id: 'player', email: 'player@example.test'}
beforeEach(() => {db = coachDb({coach_student_invites: [{id: 'invite', coach_user_id: 'coach', student_link_id: 'student', invite_token: 'token', invite_email: user.email, status: 'pending', expires_at: '2030-01-01T00:00:00Z', updated_at: '2026-10-30T12:00:00Z', accepted_by_user_id: null}], coach_player_links: [{id: 'student', coach_user_id: 'coach', player_user_id: null, status: 'active', updated_at: '2026-10-30T12:00:00Z'}]})})
const accept = () => acceptCoachInvitation(db.client, 'token', user)
it('reserves the invitation before linking and supports exact-owner recovery after a lost response', async () => {
 await accept(); expect(db.calls.filter(c => c.operation === 'update').map(c => c.table)).toEqual(['coach_student_invites', 'coach_player_links'])
 expect(db.tables.coach_player_links[0].player_user_id).toBe(user.id)
 const before = db.calls.length; await accept(); expect(db.calls.slice(before).some(c => c.operation === 'update')).toBe(false)
})
it.each(['revoked', 'expired', 'accepted'])('rejects unavailable %s invitations before changing connections', async status => {db.tables.coach_student_invites[0].status = status; await expect(accept()).rejects.toMatchObject({status: 409}); expect(db.calls.some(c => c.operation === 'update')).toBe(false)})
it('checks email, expiry, coach ownership and existing player connections', async () => {
 db.tables.coach_student_invites[0].invite_email = 'other@example.test'; await expect(accept()).rejects.toMatchObject({status: 403})
 db.tables.coach_student_invites[0].invite_email = user.email; db.tables.coach_student_invites[0].expires_at = '2020-01-01T00:00:00Z'; await expect(accept()).rejects.toMatchObject({status: 410})
 db.tables.coach_student_invites[0].expires_at = null; db.tables.coach_player_links[0].player_user_id = 'other'; await expect(accept()).rejects.toMatchObject({status: 409})
 db.tables.coach_player_links[0].player_user_id = null; db.tables.coach_player_links[0].coach_user_id = 'foreign'; await expect(accept()).rejects.toMatchObject({status: 409})
 expect(db.calls.some(c => c.operation === 'update')).toBe(false)
})
it('cannot beat a concurrent revoke or acceptance', async () => {db.hooks.beforeWrite = t => {if (t === 'coach_student_invites') db.tables.coach_student_invites[0].status = 'revoked'}; await expect(accept()).rejects.toMatchObject({status: 409}); expect(db.tables.coach_player_links[0].player_user_id).toBeNull()})
it('does not overwrite a concurrent player connection, paused student or coach update', async () => {
 db.hooks.beforeWrite = t => {if (t === 'coach_player_links') db.tables.coach_player_links[0].player_user_id = 'other'}
 await expect(accept()).rejects.toMatchObject({status: 409}); expect(db.tables.coach_player_links[0].player_user_id).toBe('other')
 db.hooks.beforeWrite = null; db.tables.coach_player_links[0].player_user_id = null; db.tables.coach_player_links[0].status = 'paused'; await expect(accept()).rejects.toMatchObject({status: 409})
 db.tables.coach_player_links[0].status = 'active'; await accept(); expect(db.tables.coach_player_links[0].player_user_id).toBe(user.id)
})
it('resumes only the reserved user after a partial connection failure', async () => {
 db.hooks.beforeWrite = t => {if (t === 'coach_player_links') db.tables.coach_player_links[0].updated_at = '2030-01-01T00:00:00Z'}
 await expect(accept()).rejects.toMatchObject({status: 409}); expect(db.tables.coach_student_invites[0]).toMatchObject({status: 'accepted', accepted_by_user_id: user.id})
 await expect(acceptCoachInvitation(db.client, 'token', {id: 'other', email: user.email})).rejects.toMatchObject({status: 409})
 db.hooks.beforeWrite = null; await accept(); expect(db.tables.coach_player_links[0].player_user_id).toBe(user.id)
})
