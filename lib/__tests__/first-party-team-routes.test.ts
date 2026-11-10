import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST as invite } from '../../app/api/mobile/first-party/team-invites/route'
import { GET as room, POST as write } from '../../app/api/mobile/first-party/team-rooms/route'

const { auth, from, act, read, save } = vi.hoisted(() => ({
  auth: vi.fn(), from: vi.fn(), act: vi.fn(), read: vi.fn(), save: vi.fn(),
}))
vi.mock('@/lib/mobile-account-auth', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/mobile-account-auth')>(),
  verifiedAccount: auth,
  accountClient: () => ({ from }),
}))
vi.mock('@/lib/native-team-invites', () => ({ actOnNativeInvite: act }))
vi.mock('@/lib/native-coach-chat-unread', () => ({ nativeCoachChatUnread: vi.fn() }))
vi.mock('@/lib/first-party-team-chat', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/first-party-team-chat')>(),
  readFirstPartyChat: read,
  writeFirstPartyChat: save,
}))

const owner = '10000000-0000-4000-8000-000000000001'
const scope = { teamName: 'Baseline Aces', leagueName: 'City League', flight: '4.0' }
const approved = { ...scope, roomId: '10000000-0000-4000-8000-000000000002' }
const member = { profile_user_id: owner, team_name: scope.teamName, league_name: scope.leagueName,
  flight: scope.flight, status: 'accepted', archived_at: null, source_type: 'manual_invite' }
const fingerprint = { ...approved, inviteId: '10000000-0000-4000-8000-000000000003',
  creatorId: '10000000-0000-4000-8000-000000000004', expiresAt: '2030-01-01T00:00:00Z' }
const preview = { ok: true, status: 200, nativeTeamInvite: 1, review: { ...fingerprint,
  expected: fingerprint, linkVersion: 'v1', alreadyJoined: false } }
const token = '10000000-0000-4000-8000-000000000005'
const root = 'https://example.test/api/mobile/first-party/team-rooms'
const query = '?'+new URLSearchParams({ team: scope.teamName, league: scope.leagueName, flight: scope.flight })
const post = (body: object) => new Request(root, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

let links: object[]
let roomId: string | null
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service')
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([approved]))
  auth.mockResolvedValue({ user: { id: owner }, token: 'verified' })
  links = [member]
  roomId = approved.roomId
  from.mockImplementation((table: string) => {
    const result = { data: table === 'team_profile_links' ? links : roomId ? { id: roomId } : null, error: null }
    const q = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(),
      limit: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result) }
    for (const method of [q.select, q.eq, q.is, q.in]) method.mockReturnValue(q)
    return q
  })
})
afterEach(() => vi.unstubAllEnvs())

it('returns an empty private feed without reading team data when approval is absent', async () => {
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', '')
  const result = await room(new Request(root))
  expect(result.headers.get('cache-control')).toBe('private, no-store')
  expect(await result.json()).toEqual({ ok: true, owner, releaseScope: 'first-party', room: null, teams: [] })
  expect(from).not.toHaveBeenCalled()
  expect((await invite(post({ action: 'preview', token }))).status).toBe(404)
  expect(act).not.toHaveBeenCalled()
})

it('rejects foreign, archived and import-only links before invoking conversation reads', async () => {
  links = [ { ...member, profile_user_id: token }, { ...member, archived_at: '2026-10-01' },
    { ...member, source_type: 'data_assist_import' }, { ...member, status: 'pending' } ]
  expect((await room(new Request(root+query))).status).toBe(403)
  expect(from.mock.calls).toEqual([['team_profile_links']])
  expect(read).not.toHaveBeenCalled()
})

it('requires one exact reviewed team and room for reads and writes', async () => {
  expect((await room(new Request(root+query+'&chatRoom='+token))).status).toBe(400)
  expect((await room(new Request(root+query+'&team=Other'))).status).toBe(400)
  expect((await write(post({ ...scope, action: 'send', chatRoomId: token }))).status).toBe(400)
  expect(from).not.toHaveBeenCalled()
  roomId = token
  expect((await room(new Request(root+query))).status).toBe(403)
  expect((await write(post({ ...scope, action: 'send' }))).status).toBe(403)
  expect(read).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
  roomId = approved.roomId
  read.mockResolvedValue({ ok: true, room: { id: roomId } })
  const result = await room(new Request(root+query))
  expect(await result.json()).toMatchObject({ ok: true, owner, releaseScope: 'first-party', teams: [{ ...scope, canManage: false }] })
  expect(read).toHaveBeenCalledWith(expect.anything(), owner, approved, new URLSearchParams(query))
})

it('rejects an unreviewed invite or changed fingerprint before any join and accepts the original fingerprint', async () => {
  act.mockResolvedValueOnce({ ...preview, review: { ...preview.review, roomId: token, expected: { ...fingerprint, roomId: token } } })
  expect((await invite(post({ action: 'preview', token }))).status).toBe(404)
  act.mockResolvedValueOnce(preview)
  expect((await invite(post({ action: 'join', token, expected: { invite: { ...fingerprint, roomId: token }, linkVersion: 'v1' } }))).status).toBe(409)
  expect(act.mock.calls.map(([, , body]) => body.action)).toEqual(['preview', 'preview'])

  act.mockResolvedValueOnce(preview).mockResolvedValueOnce({ ok: true, status: 200, roomId: approved.roomId })
  const command = { action: 'join', token, expected: { invite: fingerprint, linkVersion: 'v1' } }
  const result = await invite(post(command))
  expect(await result.json()).toMatchObject({ ok: true, owner, roomId: approved.roomId, releaseScope: 'first-party' })
  expect(act).toHaveBeenLastCalledWith(expect.anything(), owner, command)
})
