import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST as invite } from '../../app/api/mobile/first-party/team-invites/route'
import { GET as room, POST as write } from '../../app/api/mobile/first-party/team-rooms/route'
import { POST as brand } from '../../app/api/mobile/first-party/team-rooms/branding/route'
import { POST as brandGroup } from '../../app/api/mobile/first-party/player-chats/branding/route'

const { auth, from, rpc, act, read, save, access, manage, schedule, saveLogo, loadLogos } = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: vi.fn(), from: vi.fn(), act: vi.fn(), read: vi.fn(), save: vi.fn(), access: vi.fn(), manage: vi.fn(), schedule: vi.fn(), saveLogo: vi.fn(), loadLogos: vi.fn(),
}))
vi.mock('@/lib/mobile-account-auth', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/mobile-account-auth')>(),
  verifiedAccount: auth,
  accountClient: () => ({ from, rpc }),
}))
vi.mock('@/lib/native-team-invites', () => ({ actOnNativeInvite: act }))
vi.mock('@/lib/native-captain-invites', () => ({ actOnCaptainInvite: manage }))
vi.mock('@/lib/player-api-auth', () => ({ loadPlayerAccess: access }))
vi.mock('@/lib/native-coach-chat-unread', () => ({ nativeCoachChatUnread: vi.fn() }))
vi.mock('@/lib/team-branding-storage', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/team-branding-storage')>(),
  saveTeamLogo: saveLogo,
  loadTeamLogoUrls: loadLogos,
}))
vi.mock('@/lib/first-party-team-schedule', () => ({ loadReviewedTeamNextMatch: schedule }))
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
let namedBrandRoomId: string | null
let removed: boolean
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service')
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([approved]))
  auth.mockResolvedValue({ user: { id: owner }, token: 'verified' })
  links = [member]
  roomId = approved.roomId
  namedBrandRoomId = null
  removed = false
  loadLogos.mockResolvedValue(new Map<string,string>())
  from.mockImplementation((table: string) => {
    const result = { data: table === 'team_profile_links' ? links : roomId ? { id: roomId } : null, error: null }
    const lists: Partial<Record<string, object[]>> = {
      internal_conversations: roomId ? [{ id: roomId, related_entity_id: 'baseline aces__city league__4 0' }] : [],
      internal_conversation_participants: [{ conversation_id: approved.roomId }],
      team_room_member_removals: removed ? [{ conversation_id: approved.roomId }] : [],
    }
    const list = lists[table]
    const single = table === 'team_room_member_removals' ? { data: removed ? { profile_id: owner } : null, error: null } : result
    const q = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(),
      limit: vi.fn().mockResolvedValue(list ? { data: list, error: null } : result), maybeSingle: vi.fn(() =>
        table === 'internal_conversations' && q.eq.mock.calls.some(([key,value])=>key==='related_entity_type'&&value==='team_room_chat')
          ? Promise.resolve({ data: namedBrandRoomId ? { id: namedBrandRoomId, metadata: {} } : null, error: null })
          : Promise.resolve(single)) }
    for (const method of [q.select, q.eq, q.is, q.in]) method.mockReturnValue(q)
    return q
  })
})
afterEach(() => vi.unstubAllEnvs())

it('checks only first-party links when the reviewed list is empty and rejects an unregistered invite', async () => {
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', '')
  const result = await room(new Request(root))
  expect(result.headers.get('cache-control')).toBe('private, no-store')
  expect(await result.json()).toEqual({ ok: true, owner, releaseScope: 'first-party', room: null, teams: [] })
  expect(from.mock.calls).toEqual([['team_profile_links']])
  act.mockResolvedValueOnce(preview)
  expect((await invite(post({ action: 'preview', token }))).status).toBe(404)
  expect(act).toHaveBeenCalledOnce()
})

it('rejects foreign, archived and import-only links before invoking conversation reads', async () => {
  links = [ { ...member, profile_user_id: token }, { ...member, archived_at: '2026-10-01' },
    { ...member, source_type: 'data_assist_import' }, { ...member, status: 'pending' } ]
  expect((await room(new Request(root+query))).status).toBe(403)
  expect(from.mock.calls).toEqual([['team_profile_links']])
  expect(read).not.toHaveBeenCalled()
})

it('checks captain setup privately and never grants access or returns the unreviewed team', async () => {
  const request = () => new Request(root + '?op=captain-setup')
  expect((await room(new Request(root + '?op=captain-setup&team=Other'))).status).toBe(400)
  auth.mockResolvedValueOnce(null)
  expect((await room(request())).status).toBe(401)
  access.mockResolvedValueOnce({ canUseCaptainWorkflow: false })
  const noAccess = await room(request())
  expect(noAccess.headers.get('cache-control')).toBe('private, no-store')
  expect(await noAccess.json()).toEqual({ ok: true, owner, releaseScope: 'first-party', captainChatSetup: 'needs-captain-access' })
  expect(from).not.toHaveBeenCalled()

  access.mockResolvedValue({ canUseCaptainWorkflow: true })
  links = [{ ...member, team_roles: ['captain'], source_type: 'data_assist_import' }, { ...member }]
  expect(await (await room(request())).json()).toEqual({ ok: true, owner, releaseScope: 'first-party', captainChatSetup: 'needs-team' })
  links = [{ ...member, team_roles: ['co_captain'], team_name: 'Unreviewed team' }]
  expect(await (await room(request())).json()).toEqual({ ok: true, owner, releaseScope: 'first-party', captainChatSetup: 'needs-review' })
  expect(from.mock.calls).toEqual([['team_profile_links'], ['team_profile_links']])

  links = [{ ...member, team_roles: ['captain'] }]
  removed = true
  expect(await (await room(request())).json()).toEqual({ ok: true, owner, releaseScope: 'first-party', captainChatSetup: 'needs-room-access' })
  removed = false
  roomId = token
  expect(await (await room(request())).json()).toMatchObject({ captainChatSetup: 'needs-room-access' })
  roomId = approved.roomId
  const otherLeague = { ...approved, leagueName: 'Evening League', roomId: token }
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([approved, otherLeague]))
  links.push({ ...member, team_roles: ['captain'], league_name: otherLeague.leagueName },
    { ...member, team_roles: ['captain'], team_name: 'Unreviewed team' })
  expect(await (await room(request())).json()).toEqual({
    ok: true, owner, releaseScope: 'first-party', captainChatSetup: 'ready', captainInviteTeams: [scope],
  })
  expect(read).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
  expect(manage).not.toHaveBeenCalled()
})

it('requires one exact reviewed team and room for reads and writes', async () => {
  expect((await room(new Request(root+query+'&chatRoom=invalid'))).status).toBe(400)
  expect((await room(new Request(root+'?chatRoom='+token))).status).toBe(400)
  expect((await room(new Request(root+query+'&team=Other'))).status).toBe(400)
  expect((await write(post({ ...scope, action: 'send', chatRoomId: 'invalid' }))).status).toBe(400)
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
  expect(read).toHaveBeenCalledWith(expect.anything(), owner, expect.objectContaining(approved), new URLSearchParams(query))
})

it('uses the exact parent for named chats and rejects official match actions in them', async () => {
  const roomReply = { ok: true, status: 200, namedRooms: 1, parentId: approved.roomId, teamMuted: false, id: token, name: 'Practice' }
  rpc.mockReturnValue({ retry: async () => ({ data: roomReply }) })
  read.mockImplementation(async (_service, _owner, _team, _params, chatRoom) => ({ ok: true, room: { id: token, chatRoom } }))
  const request = new Request(root+query+'&chatRoom='+token)
  expect(await (await room(request)).json()).toMatchObject({ room: {
    id: token, chatRoom: { id: token, parentId: approved.roomId, name: 'Practice' }, manualFixture: true, canScheduleMatch: false,
  } })
  expect(rpc).toHaveBeenLastCalledWith('native_first_party_team_chat_rooms', expect.objectContaining({
    p_owner: owner, p_action: 'open', p_id: token, p_parent: approved.roomId,
  }))
  expect(read.mock.lastCall?.[4]).toMatchObject({ id: token, parentId: approved.roomId })
  save.mockResolvedValue({ ok: true, status: 200 })
  const message = { ...scope, action: 'send', chatRoomId: token, body: 'Friday at 6' }
  expect((await write(post(message))).status).toBe(200)
  expect(save).toHaveBeenCalledWith(expect.anything(), owner, token, message)
  save.mockClear()
  expect((await write(post({ ...message, action: 'set_next_match' }))).status).toBe(400)
  rpc.mockReturnValue({ retry: async () => ({ data: { ok: false, status: 403 } }) })
  expect((await write(post(message))).status).toBe(403)
  expect(save).not.toHaveBeenCalled()
  read.mockClear()
  expect((await room(request)).status).toBe(403)
  expect(read).not.toHaveBeenCalled()
})

it('allows a team captain with captain access to create a chat on the authorized parent', async () => {
  const change = { ...scope, action: 'create_chat_room', clientRoomId: token, roomName: 'Practice' }
  expect((await write(post(change))).status).toBe(403)
  links = [{ ...member, team_roles: ['captain'] }]
  access.mockResolvedValueOnce({ canUseCaptainWorkflow: false })
  expect((await write(post(change))).status).toBe(403)
  expect(rpc).not.toHaveBeenCalled()
  access.mockResolvedValue({ canUseCaptainWorkflow: true })
  rpc.mockReturnValue({ retry: async () => ({ data: {
    ok: true, status: 200, namedRooms: 1, parentId: approved.roomId, teamMuted: false, id: token, name: 'Practice',
  } }) })
  expect(await (await write(post(change))).json()).toMatchObject({ ok: true, owner, id: token })
  expect(rpc).toHaveBeenCalledWith('native_first_party_team_chat_rooms', expect.objectContaining({
    p_owner: owner, p_action: 'create', p_parent: approved.roomId, p_id: token,
  }))
})

it('allows only a current entitled captain to manage the exact team chat icon', async () => {
  const change = { ...scope, roomId: approved.roomId, photo: null }
  expect((await brand(post(change))).status).toBe(403)
  links = [{ ...member, team_roles: ['co_captain'] }]
  access.mockResolvedValue({ canUseCaptainWorkflow: true })
  expect((await brand(post({ ...change, roomId: token }))).status).toBe(403)
  removed = true
  expect((await brand(post(change))).status).toBe(403)
  removed = false
  access.mockResolvedValueOnce({ canUseCaptainWorkflow: false })
  expect((await brand(post(change))).status).toBe(403)
  expect((await brand(post({ ...change, photo: 'YWJjZA==' }))).status).toBe(400)
  expect(saveLogo).not.toHaveBeenCalled()
  saveLogo.mockResolvedValue(200)
  expect(await (await brand(post(change))).json()).toEqual({
    ok: true, owner, roomId: approved.roomId, releaseScope: 'first-party', hasLogo: false,
  })
  expect(saveLogo).toHaveBeenCalledOnce()
})

it('requires the captain’s verified child room before saving a named chat icon', async () => {
  const change = { ...scope, roomId: token, chatRoomId: token, photo: null }
  expect((await brand(post(change))).status).toBe(403)
  links = [{ ...member, team_roles: ['captain'] }]
  access.mockResolvedValue({ canUseCaptainWorkflow: true })
  namedBrandRoomId = token
  rpc.mockReturnValueOnce({ retry: async () => ({ data: { ok: false, status: 404 } }) })
  expect((await brand(post(change))).status).toBe(404)
  expect(saveLogo).not.toHaveBeenCalled()
  rpc.mockReturnValueOnce({ retry: async () => ({ data: {
    ok: true, status: 200, namedRooms: 1, parentId: approved.roomId, teamMuted: false, id: token, name: 'Practice',
  } }) })
  saveLogo.mockResolvedValueOnce(200)
  expect((await brand(post(change))).status).toBe(200)
  expect(rpc).toHaveBeenCalledWith('native_first_party_team_chat_rooms', expect.objectContaining({ p_parent: approved.roomId, p_id: token }))
  expect(saveLogo).toHaveBeenCalledWith(expect.anything(), token, {}, null)
})

it('keeps authorized logos present in the team list after opening a conversation', async () => {
  const logo = 'https://example.test/signed-logo'
  loadLogos.mockImplementation(async (_service, ids: string[]) =>
    new Map(ids.includes(approved.roomId) ? [[approved.roomId,logo]] : []))
  read.mockResolvedValue({ ok: true, room: { id: approved.roomId } })
  const opened = await room(new Request(root+query))
  expect(await opened.json()).toMatchObject({teams:[{...scope,teamLogoUrl:logo}],room:{teamLogoUrl:logo}})
  removed = true
  const inbox = await room(new Request(root))
  expect((await inbox.json()).teams[0]).not.toHaveProperty('teamLogoUrl')
})

it('requires an open group owned and managed by the caller before changing its logo', async () => {
  const group = approved.roomId
  const change = { room: group, photo: null }
  auth.mockResolvedValueOnce(null)
  expect((await brandGroup(post(change))).status).toBe(401)
  expect((await brandGroup(post({ ...change, extra: true }))).status).toBe(400)
  expect(from).not.toHaveBeenCalled()

  roomId = null
  expect((await brandGroup(post(change))).status).toBe(403)
  const query = from.mock.results[0].value
  expect(query.eq.mock.calls).toEqual([
    ['id', group], ['related_entity_type', 'player_group'], ['created_by_user_id', owner], ['status', 'open'],
  ])
  expect(rpc).not.toHaveBeenCalled()

  roomId = group
  rpc.mockReturnValueOnce({ retry: async () => ({ data: { code: 'ok', room: { manage: false } } }) })
  expect((await brandGroup(post(change))).status).toBe(403)
  expect(saveLogo).not.toHaveBeenCalled()

  rpc.mockReturnValue({ retry: async () => ({ data: { code: 'ok', room: { manage: true } } }) })
  expect((await brandGroup(post({ ...change, photo: 'YWJjZA==' }))).status).toBe(400)
  saveLogo.mockResolvedValueOnce(200)
  expect(await (await brandGroup(post(change))).json()).toEqual({
    ok: true, owner, releaseScope: 'first-party', roomId: group, hasLogo: false,
  })
  expect(saveLogo).toHaveBeenCalledOnce()
})

it('offers invite management only to entitled captains of the reviewed room', async () => {
  const command = { ...scope, action: 'create', id: token }
  const rejected = await invite(post(command))
  expect(rejected.status).toBe(403)
  expect(access).not.toHaveBeenCalled()
  links = [{ ...member, team_role: 'co_captain', team_roles: ['co_captain'] }]
  roomId = token
  expect((await invite(post(command))).status).toBe(403)
  roomId = approved.roomId
  access.mockResolvedValue({ canUseCaptainWorkflow: false })
  expect((await invite(post(command))).status).toBe(403)
  expect(manage).not.toHaveBeenCalled()

  access.mockResolvedValue({ canUseCaptainWorkflow: true })
  read.mockResolvedValue({ ok: true, room: { id: roomId, canManage: false } })
  expect(await (await room(new Request(root+query))).json()).toMatchObject({ room: { canInviteTeammates: true, canManage: false } })
  manage.mockResolvedValue({ ok: true, status: 200, nativeCaptainInvites: 1, action: 'create', scope })
  const result = await invite(post(command))
  expect(await result.json()).toMatchObject({ ok: true, releaseScope: 'first-party', owner, action: 'create' })
  expect(manage).toHaveBeenCalledOnce()
  expect(manage).toHaveBeenCalledWith(expect.anything(), owner, command, approved.roomId)
  expect(act).not.toHaveBeenCalled()
})

it('loads a linked next match only for a current member who asks for the exact team', async () => {
  const linked = { ...approved, scheduleLeagueId: 'city-league-spring' }
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([linked]))
  read.mockResolvedValue({ ok: true, room: { id: roomId } })
  expect(await (await room(new Request(root + query))).json()).toMatchObject({ room: { scheduleLinked: true } })
  expect(schedule).not.toHaveBeenCalled()

  const request = () => new Request(root + query + '&op=next-match')
  expect((await room(new Request(root + '?op=next-match'))).status).toBe(400)
  expect((await room(new Request(request().url + '&season=other'))).status).toBe(400)
  expect((await room(new Request(request().url.replace('flight=4.0', 'flight=4.5')))).status).toBe(403)
  removed = true
  expect((await room(request())).status).toBe(403)
  expect(schedule).not.toHaveBeenCalled()

  removed = false
  const nextMatch = { opponent: 'Topspin Club', date: '2026-12-01', time: '18:00', facility: 'Court 2', timeZone: 'America/Chicago' }
  schedule.mockResolvedValueOnce(nextMatch)
  const response = await room(request())
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ ok: true, releaseScope: 'first-party', owner, roomId, revision: null, nextMatch })
  expect(schedule).toHaveBeenCalledWith(expect.anything(), owner, expect.objectContaining(linked))
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
