import {beforeEach, expect, it, vi} from 'vitest'
import {coachDb} from '../../tests/fixtures/coach-db'
import {coachOwner, coachRevision} from '../../tests/fixtures/native-coach'
import {readCoachInviteIntent, readCoachInvitations, coachInviteMatches, type CoachInviteIntent} from '../native-coach-invite-contract'
const auth = vi.hoisted(() => ({status: 200, client: {} as unknown}))
vi.mock('../coach-api-auth', () => ({getCoachApiAuth: async () => auth.status === 200 ? {ok: true, userId: '11111111-1111-4111-8111-111111111111', supabase: auth.client} : {ok: false, response: Response.json({}, {status: auth.status})}}))
import {GET, POST} from '../../app/api/mobile/coach/invites/route'
const intent: CoachInviteIntent = {action: 'create', id: '66666666-6666-4666-8666-666666666666', student: 'student-one', expectedUpdatedAt: coachRevision, email: 'player@example.test', message: 'Let’s work on your serve.'}
let db: ReturnType<typeof coachDb>
const url = 'https://synthetic.invalid/api/mobile/coach/invites'
const get = () => GET(new Request(url + '?student=student-one'))
const post = (body: unknown) => POST(new Request(url, {method: 'POST', body: JSON.stringify(body)}))
beforeEach(() => {auth.status = 200; db = coachDb({coach_player_links: [{id: 'student-one', coach_user_id: coachOwner, player_name: 'Taylor Chen', player_user_id: null, status: 'active', updated_at: coachRevision}], coach_student_invites: [{id: 'foreign', coach_user_id: 'other', student_link_id: 'student-one', invite_email: 'private@example.test'}]}); auth.client = db.client})
it.each([401, 403])('uses existing Coach access before any invitation query (%s)', async status => {auth.status = status; expect((await get()).status).toBe(status); expect((await post(intent)).status).toBe(status); expect(db.calls).toEqual([])})
it('creates one owner-scoped email invitation with a server token and seven-day expiry, without sending messages', async () => {
 const start = Date.now(), response = await post(intent); expect(response.status).toBe(200)
 const result = await response.json(); expect(result.invites).toHaveLength(1); expect(result.invites[0]).toMatchObject({id: intent.id, email: intent.email, message: intent.message, status: 'pending'})
 expect(Date.parse(result.invites[0].expiresAt) - start).toBeGreaterThan(6.99 * 86400000)
 expect(result.invites[0].href).toMatch(/^https:\/\/www.tenaceiq.com\/coach\/invite\/[a-f0-9-]{36}$/)
 expect(response.headers.get('cache-control')).toContain('no-store'); expect(response.headers.get('referrer-policy')).toBe('no-referrer')
 expect(JSON.stringify(result)).not.toContain('private@example'); expect(JSON.stringify(result)).not.toContain('coach_user_id')
 expect(db.calls.filter(c => c.operation === 'read').every(c => c.filters.some(([k, v]) => k === 'coach_user_id' && v === coachOwner))).toBe(true)
 expect((await post(intent)).status).toBe(409); expect(db.tables.coach_student_invites.filter(i => i.id === intent.id)).toHaveLength(1)
})
it('rejects linked, paused, foreign or stale students before creating a link', async () => {
 for (const patch of [{player_user_id: 'other'}, {status: 'paused'}, {updated_at: '2020-01-01T00:00:00Z'}, {coach_user_id: 'other'}]) {
  Object.assign(db.tables.coach_player_links[0], {player_user_id: null, status: 'active', updated_at: coachRevision, coach_user_id: coachOwner}, patch)
  expect((await post(intent)).status).toBe(patch.coach_user_id ? 404 : 409)
 }
 expect(db.calls.some(c => c.operation === 'insert')).toBe(false)
})
it('revokes only the unchanged pending owned invitation and retains accepted history', async () => {
 await post(intent); const row = db.tables.coach_student_invites.find(i => i.id === intent.id)!
 const revoke = {action: 'revoke', id: row.id, student: intent.student, expectedUpdatedAt: row.updated_at}
 row.status = 'accepted'; expect((await post(revoke)).status).toBe(409)
 row.status = 'pending'; db.hooks.beforeWrite = table => {if (table === 'coach_student_invites') row.updated_at = '2030-01-01T00:00:00Z'}
 expect((await post(revoke)).status).toBe(409); expect(row.status).toBe('pending')
 db.hooks.beforeWrite = null; const response = await post({...revoke, expectedUpdatedAt: row.updated_at}); expect(response.status).toBe(200)
 expect(coachInviteMatches(readCoachInvitations(await response.json(), coachOwner, intent.student), readCoachInviteIntent({...revoke, expectedUpdatedAt: '2030-01-01T00:00:00Z'}))).toBe(true)
 expect(row.status).toBe('revoked'); expect(row.invite_token).toBeTruthy()
})
it('does not return share links for expired invitations or connected students', async () => {
 await post(intent); const row = db.tables.coach_student_invites.find(i => i.id === intent.id)!
 row.expires_at = '2020-01-01T00:00:00Z'; let response = await (await get()).json(); expect(response.invites[0]).toMatchObject({status: 'expired', href: ''})
 row.expires_at = '2030-01-01T00:00:00Z'; db.tables.coach_player_links[0].player_user_id = 'player'; response = await (await get()).json(); expect(response.invites[0].href).toBe('')
})
it('rejects owner injection, invalid emails, duplicate queries and oversized Unicode before queries', async () => {
 for (const body of [{...intent, owner: 'other'}, {...intent, email: ''}, {...intent, email: 'someone'}, {...intent, message: '🎾'.repeat(1500)}]) expect([400, 413]).toContain((await post(body)).status)
 for (const query of ['', '?student=x&student=y', '?student=student-one&owner=other']) expect((await GET(new Request(url + query))).status).toBe(400)
 expect(db.calls).toEqual([])
})
it('contains database errors', async () => {db.hooks.fail = true; const response = await get(); expect(response.status).toBe(503); expect(await response.text()).not.toContain('SQL')})
