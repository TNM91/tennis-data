import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { countFirstPartyChats, readFirstPartyChat, reviewedTeamOptions, writeFirstPartyChat } from '@/lib/first-party-team-chat'
import { loadTeamMatchReplies, saveTeamMatchReply } from '@/lib/first-party-team-replies'
import { loadTeamResultRoster, loadTeamResults, saveTeamResult } from '@/lib/first-party-team-results'
import { findReviewedTeamConversation, loadActiveReviewedTeamRoomActivity, loadCaptainChatSetup, loadReviewedTeamLinks, readReviewedTeamRooms, type ReviewedTeamRoom } from '@/lib/first-party-team-scopes'
import { loadManualTeamNextMatch, loadReviewedTeamNextMatch, saveManualTeamNextMatch, upcomingTeamMatch } from '@/lib/first-party-team-schedule'
import { nativeCoachChatUnread } from '@/lib/native-coach-chat-unread'
import { loadPlayerAccess } from '@/lib/player-api-auth'
import { privateTeamLeagueKey, privateTeamRoomId, readPrivateTeamInput } from '@/lib/private-team-contract'
import { supabaseKey } from '@/lib/supabase-public-config'
import { fixtureId, readTeamNextMatchChange } from '@/lib/team-fixtures-contract'
import { readSavedTeamLineup, readTeamLineupChange } from '@/lib/team-match-lineup-contract'
import { readTeamMatchReplyChange } from '@/lib/team-match-replies-contract'
import { readTeamResultChange } from '@/lib/team-results-contract'
import { checkTeamChatAccess } from '@/lib/team-chat-updates'
import { loadTeamLogoUrls } from '@/lib/team-branding-storage'
import { namedChatRoomId, namedTeamChatRooms, type NamedChatRoom } from '@/lib/named-team-chat-rooms'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) => accountResponse(
  { ...body, releaseScope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' },
)
const denied = (status: number) => json({ ok: false }, status)
const scopeKeys = ['team', 'league', 'flight']
const namedChatActions = new Set(['send', 'edit_chat_post', 'remove_chat_post', 'set_chat_reaction', 'mark_chat_read',
  'report_chat_message', 'block_chat_member', 'unblock_chat_member', 'set_chat_display_name'])

async function openNamedChat(service: ReturnType<typeof accountClient>, owner: string, team: ReviewedTeamRoom, id: string) {
  const result = await namedTeamChatRooms(service, owner, team, 'open', id, undefined, team.roomId)
  if (!result.ok) return result
  if (!('id' in result)) return { ok: false as const, status: 503 }
  const chat: NamedChatRoom = { id: result.id, parentId: result.parentId, name: result.name, teamMuted: result.teamMuted }
  return { ok: true as const, chat }
}

export async function GET(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    const params = new URL(request.url).searchParams
    const op = params.get('op') ?? 'room'
    const fields = op === 'updates' ? ['before', 'focus'] : op === 'message' ? ['message', 'view'] : op === 'match-replies' ? ['revision'] : []
    const scopedOps = ['updates', 'message', 'next-match', 'match-replies', 'team-results', 'result-roster', 'chats']
    const chatRoomId = params.get('chatRoom')
    const allowed = ['op', ...fields, ...(['room', 'updates', 'message'].includes(op) ? ['chatRoom'] : []),
      ...(op === 'room' || scopedOps.includes(op) ? scopeKeys : [])]
    const selecting = params.has('chatRoom') || scopeKeys.some(key => params.has(key)) || scopedOps.includes(op)
    if (!['room', 'teams', 'unread', 'captain-setup', ...scopedOps].includes(op) ||
        [...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1) ||
        selecting && scopeKeys.some(key => !params.has(key)) ||
        params.has('chatRoom') && !namedChatRoomId(chatRoomId) ||
        op === 'match-replies' && !fixtureId(params.get('revision'))) return denied(400)

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return denied(503)
    const service = accountClient(key), owner = account.user.id
    if (op === 'captain-setup') {
      const access = await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)
      const setup = access.canUseCaptainWorkflow
        ? await loadCaptainChatSetup(service, owner, readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS))
        : { captainChatSetup: 'needs-captain-access' }
      return json({ ok: true, owner, ...setup })
    }
    const approvals = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
    const teams = await loadReviewedTeamLinks(service, owner, approvals)
    if (op === 'unread') {
      const [counts, coach] = await Promise.all([
        countFirstPartyChats(service, owner, teams),
        nativeCoachChatUnread(accountClient(supabaseKey, account.token), owner)
          .catch(() => ({ available: false, total: 0, connections: [] })),
      ])
      const chatIds = counts.teams.flatMap(team => team.rooms?.filter(room => room.hasLogo).map(room => room.id) ?? [])
      const logos = new Map<string, string>()
      for (let start = 0; start < chatIds.length; start += 60) {
        const batch = await loadTeamLogoUrls(service, chatIds.slice(start, start + 60), 'team_room_chat').catch(() => null)
        for (const [id, logo] of batch ?? []) logos.set(id, logo)
      }
      return json({ ok: true, ...counts, coach, teams: counts.teams.map(team => ({
        ...team, ...(team.rooms ? { rooms: team.rooms.map(room => ({ ...room, logo: logos.get(room.id) })) } : {}),
      })) })
    }
    const options = reviewedTeamOptions(teams)
    const inboxOptions = async () => {
      const activity = await loadActiveReviewedTeamRoomActivity(service, owner, teams).catch(() => new Map<string, string>())
      const logos = await loadTeamLogoUrls(service, [...activity.keys()]).catch(() => new Map<string, string>())
      return options.map((team, index) => {
        const roomId = teams[index].roomId
        const teamLogoUrl = logos.get(roomId), activityAt = activity.get(roomId)
        return { ...team, ...(teamLogoUrl ? { teamLogoUrl } : {}), ...(activityAt ? { activityAt } : {}) }
      })
    }
    if (!selecting) {
      return json({ ok: true, owner, teams: await inboxOptions(), room: null })
    }
    const selected = teams.find(team => team.teamName === params.get('team') &&
      team.leagueName === params.get('league') && team.flight === params.get('flight'))
    if (!selected || !await findReviewedTeamConversation(service, selected)) return denied(403)
    if (op === 'chats') {
      const list = await namedTeamChatRooms(service, owner, selected, 'list', undefined, undefined, selected.roomId)
      if (!list.ok || !('rooms' in list)) return denied(list.ok ? 503 : list.status)
      const canCreate = selected.isCaptain && list.canCreate &&
        (await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)).canUseCaptainWorkflow
      return json({ ...list, owner, canCreate })
    }
    if (op === 'team-results' || op === 'result-roster') {
      if (selected.scheduleLeagueId) return denied(403)
      const access = await checkTeamChatAccess(service, owner, selected.roomId, false)
      if (!access.ok) return denied(access.status)
      const canEdit = selected.isCaptain && (await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)).canUseCaptainWorkflow
      if (op === 'result-roster') {
        if (!canEdit) return denied(403)
        return json({ ok: true, owner, roomId: selected.roomId, players: await loadTeamResultRoster(service, selected, owner) })
      }
      return json({ ok: true, owner, roomId: selected.roomId, results: await loadTeamResults(service, selected, owner, canEdit) })
    }
    if (op === 'match-replies') {
      if (selected.scheduleLeagueId) return denied(403)
      const access = await checkTeamChatAccess(service, owner, selected.roomId, false)
      if (!access.ok) return denied(access.status)
      const captain = selected.isCaptain && (await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)).canUseCaptainWorkflow
      const schedule = await loadManualTeamNextMatch(service, selected, captain)
      if (!schedule.nextMatch || !schedule.revision || schedule.revision !== params.get('revision')) return denied(409)
      const replies = await loadTeamMatchReplies(service, selected, owner, schedule.revision, captain)
      return json({ ok: true, owner, roomId: selected.roomId, revision: schedule.revision,
        replies: { ...replies, ...(captain && schedule.lineup ? { savedLineup: schedule.lineup } : {}) } })
    }
    if (op === 'next-match') {
      const access = await checkTeamChatAccess(service, owner, selected.roomId, false)
      if (!access.ok) return denied(access.status)
      const schedule = selected.scheduleLeagueId
        ? { nextMatch: await loadReviewedTeamNextMatch(accountClient(supabaseKey, account.token), owner, selected), revision: null }
        : await loadManualTeamNextMatch(service, selected)
      return json({ ok: true, owner, roomId: selected.roomId, ...schedule })
    }
    let chatRoom: NamedChatRoom | undefined
    if (chatRoomId) {
      const opened = await openNamedChat(service, owner, selected, chatRoomId)
      if (!opened.ok) return denied(opened.status)
      chatRoom = opened.chat
    }
    const result = await (chatRoom
      ? readFirstPartyChat(service, owner, selected, params, chatRoom)
      : readFirstPartyChat(service, owner, selected, params))
    if (!result.ok) return json(result, result.status)
    if (op === 'room' && 'room' in result) {
      const [access, brandedTeams, chatLogos] = await Promise.all([
        selected.isCaptain ? loadPlayerAccess(accountClient(supabaseKey, account.token), owner).catch(() => null) : null,
        inboxOptions(),
        chatRoom ? loadTeamLogoUrls(service, [chatRoom.id], 'team_room_chat').catch(() => new Map<string, string>()) : null,
      ])
      const canManage = access?.canUseCaptainWorkflow === true
      const teamLogoUrl = brandedTeams[teams.indexOf(selected)]?.teamLogoUrl
      const chatLogoUrl = chatRoom ? chatLogos?.get(chatRoom.id) : undefined
      const teamPractices = privateTeamRoomId(selected.leagueName) === selected.roomId
      return json({ ...result, owner, teams: brandedTeams, room: {
        ...result.room,
        ...(teamLogoUrl ? { teamLogoUrl } : {}),
        ...(chatRoom ? { chatLogoUrl, canManageTeamLogo: canManage } : {}),
        ...(!chatRoom && selected.isCaptain ? { canInviteTeammates: canManage, canManageTeamLogo: canManage } : {}),
        ...(teamPractices ? { teamPractices: true, canPlanPractice: canManage } : {}),
        ...(selected.scheduleLeagueId ? { scheduleLinked: true } : { manualFixture: true, canScheduleMatch: canManage }),
      } })
    }
    return json({ ...result, owner, teams: options })
  } catch {
    return denied(503)
  }
}

export async function POST(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    if (new URL(request.url).search) return denied(400)
    const body = await readAccountJson(request, 32768)
    if (!body || typeof body.action !== 'string' ||
        body.chatRoomId !== undefined && !namedChatRoomId(body.chatRoomId)) return denied(400)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return denied(503)
    const service = accountClient(key), owner = account.user.id
    if (body.action === 'create_private_team') {
      if (body.chatRoomId !== undefined) return denied(400)
      const input = readPrivateTeamInput(body)
      if (!input || Object.keys(body).length !== 5) return denied(400)
      const access = await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)
      if (!access.canUseCaptainWorkflow) return denied(403)
      const { id, teamName, leagueLabel, flight } = input
      const { data: status, error } = await service.rpc('create_native_private_team', {
        p_owner: owner, p_id: id, p_team: teamName, p_label: leagueLabel, p_flight: flight,
      }).retry(false)
      if (error || ![200, 400, 409, 429].includes(status)) return denied(503)
      if (status !== 200) return denied(status)
      return json({ ok: true, owner, roomId: id, team: { teamName, leagueName: privateTeamLeagueKey(id), leagueLabel, flight } })
    }
    const approvals = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
    const teams = await loadReviewedTeamLinks(service, owner, approvals)
    const selected = teams.find(team => team.teamName === body.teamName &&
      team.leagueName === body.leagueName && team.flight === body.flight)
    if (!selected || !await findReviewedTeamConversation(service, selected)) return denied(403)
    if (body.action === 'create_chat_room' || body.action === 'lookup_chat_room') {
      if (body.chatRoomId !== undefined || Object.keys(body).length !== 6) return denied(400)
      if (!selected.isCaptain) return denied(403)
      const access = await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)
      if (!access.canUseCaptainWorkflow) return denied(403)
      const result = await namedTeamChatRooms(service, owner, selected,
        body.action === 'create_chat_room' ? 'create' : 'lookup', body.clientRoomId, body.roomName, selected.roomId)
      return json({ ...result, owner }, result.status)
    }
    if (body.chatRoomId !== undefined) {
      if (!namedChatActions.has(body.action)) return denied(400)
      const opened = await openNamedChat(service, owner, selected, body.chatRoomId)
      if (!opened.ok) return denied(opened.status)
      const result = await writeFirstPartyChat(service, owner, opened.chat.id, body)
      return json({ ...result, owner }, result.status)
    }
    if (body.action === 'save_match_lineup') {
      if (selected.scheduleLeagueId || selected.roomId !== body.roomId || !selected.isCaptain) return denied(403)
      const change = readTeamLineupChange(body)
      if (!change || Object.keys(body).length !== 9) return denied(400)
      const access = await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)
      if (!access.canUseCaptainWorkflow) return denied(403)
      const { data, error } = await service.rpc('save_native_team_lineup', {
        p_owner: owner, p_room: selected.roomId, p_team: selected.teamName, p_league: selected.leagueName, p_flight: selected.flight,
        p_revision: change.revision, p_expected: change.expected, p_version: change.version, p_courts: change.courts,
      }).retry(false)
      if (error || ![200, 400, 403, 409].includes(data?.status)) return denied(503)
      if (data.status !== 200) return denied(data.status)
      const lineup = readSavedTeamLineup(data.lineup)
      if (lineup?.version !== change.version) return denied(503)
      return json({ ok: true, owner, roomId: selected.roomId, revision: change.revision, lineup })
    }
    if (body.action === 'save_team_result') {
      if (selected.scheduleLeagueId || selected.roomId !== body.roomId || !selected.isCaptain) return denied(403)
      const change = readTeamResultChange(body)
      if (!change || Object.keys(body).length !== 10 + Number(change.courtScores !== undefined) + Number(change.courtPlayerIds !== undefined)) return denied(400)
      const access = await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)
      if (!access.canUseCaptainWorkflow) return denied(403)
      const status = await saveTeamResult(service, selected, owner, change)
      if (status !== 200) return denied(status)
      return json({ ok: true, owner, roomId: selected.roomId, fixtureId: change.fixtureId,
        score: { revision: change.revision, won: change.won, lost: change.lost,
          ...(change.courtScores === undefined ? {} : { courtScores: change.courtScores }),
          ...(change.courtPlayerIds === undefined ? {} : { courtPlayerIds: change.courtPlayerIds }) } })
    }
    if (body.action === 'reply_next_match') {
      if (selected.scheduleLeagueId || selected.roomId !== body.roomId) return denied(403)
      const change = readTeamMatchReplyChange(body)
      if (!change || Object.keys(body).length !== 9) return denied(400)
      const access = await checkTeamChatAccess(service, owner, selected.roomId, false)
      if (!access.ok) return denied(access.status)
      const schedule = await loadManualTeamNextMatch(service, selected)
      if (!schedule.nextMatch || schedule.revision !== change.revision) return denied(409)
      const status = await saveTeamMatchReply(service, selected, owner, change)
      if (status !== 200) return denied(status)
      return json({ ok: true, owner, roomId: selected.roomId, revision: change.revision, reply: { id: change.id, choice: change.choice } })
    }
    if (body.action === 'set_next_match') {
      if (selected.scheduleLeagueId || !selected.isCaptain || selected.roomId !== body.roomId) return denied(403)
      if (Object.keys(body).some(key => !['action', 'teamName', 'leagueName', 'flight', 'roomId', 'expected', 'revision', 'nextMatch'].includes(key))) return denied(400)
      const change = readTeamNextMatchChange(body)
      if (!change || change.nextMatch && !upcomingTeamMatch(change.nextMatch)) return denied(400)
      const access = await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)
      if (!access.canUseCaptainWorkflow) return denied(403)
      const status = await saveManualTeamNextMatch(service, owner, selected, change)
      if (status !== 200) return denied(status)
      return json({ ok: true, owner, roomId: selected.roomId, revision: change.revision, nextMatch: change.nextMatch })
    }
    const result = await writeFirstPartyChat(service, owner, selected.roomId, body)
    return json({ ...result, owner }, result.status)
  } catch {
    return denied(503)
  }
}
