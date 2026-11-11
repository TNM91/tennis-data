import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { countFirstPartyChats, readFirstPartyChat, reviewedTeamOptions, writeFirstPartyChat } from '@/lib/first-party-team-chat'
import { loadTeamMatchReplies, saveTeamMatchReply } from '@/lib/first-party-team-replies'
import { loadTeamResultRoster, loadTeamResults, saveTeamResult } from '@/lib/first-party-team-results'
import { findReviewedTeamConversation, loadCaptainChatSetup, loadReviewedTeamLinks, readReviewedTeamRooms } from '@/lib/first-party-team-scopes'
import { loadManualTeamNextMatch, loadReviewedTeamNextMatch, saveManualTeamNextMatch, upcomingTeamMatch } from '@/lib/first-party-team-schedule'
import { nativeCoachChatUnread } from '@/lib/native-coach-chat-unread'
import { loadPlayerAccess } from '@/lib/player-api-auth'
import { privateTeamLeagueKey, readPrivateTeamInput } from '@/lib/private-team-contract'
import { supabaseKey } from '@/lib/supabase-public-config'
import { fixtureId, readTeamNextMatchChange } from '@/lib/team-fixtures-contract'
import { readSavedTeamLineup, readTeamLineupChange } from '@/lib/team-match-lineup-contract'
import { readTeamMatchReplyChange } from '@/lib/team-match-replies-contract'
import { readTeamResultChange } from '@/lib/team-results-contract'
import { checkTeamChatAccess } from '@/lib/team-chat-updates'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) => accountResponse(
  { ...body, releaseScope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' },
)
const denied = (status: number) => json({ ok: false }, status)
const scopeKeys = ['team', 'league', 'flight']

export async function GET(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    const params = new URL(request.url).searchParams
    const op = params.get('op') ?? 'room'
    const fields = op === 'updates' ? ['before', 'focus'] : op === 'message' ? ['message', 'view'] : op === 'match-replies' ? ['revision'] : []
    const scopedOps = ['updates', 'message', 'next-match', 'match-replies', 'team-results', 'result-roster']
    const allowed = ['op', ...fields, ...(op === 'room' || scopedOps.includes(op) ? scopeKeys : [])]
    const selecting = scopeKeys.some(key => params.has(key)) || scopedOps.includes(op)
    if (!['room', 'teams', 'unread', 'captain-setup', ...scopedOps].includes(op) ||
        [...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1) ||
        selecting && scopeKeys.some(key => !params.has(key)) ||
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
      return json({ ok: true, ...counts, coach })
    }
    const options = reviewedTeamOptions(teams)
    if (!selecting) return json({ ok: true, owner, teams: options, room: null })
    const selected = teams.find(team => team.teamName === params.get('team') &&
      team.leagueName === params.get('league') && team.flight === params.get('flight'))
    if (!selected || !await findReviewedTeamConversation(service, selected)) return denied(403)
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
    const result = await readFirstPartyChat(service, owner, selected, params)
    if (!result.ok) return json(result, result.status)
    if (op === 'room' && 'room' in result) {
      const access = selected.isCaptain
        ? await loadPlayerAccess(accountClient(supabaseKey, account.token), owner).catch(() => null)
        : null
      return json({ ...result, owner, teams: options, room: {
        ...result.room,
        ...(selected.isCaptain ? { canInviteTeammates: access?.canUseCaptainWorkflow === true } : {}),
        ...(selected.scheduleLeagueId ? { scheduleLinked: true } : {}),
        ...(!selected.scheduleLeagueId ? { manualFixture: true, canScheduleMatch: access?.canUseCaptainWorkflow === true } : {}),
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
    if (!body || body.chatRoomId !== undefined || typeof body.action !== 'string') return denied(400)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return denied(503)
    const service = accountClient(key), owner = account.user.id
    if (body.action === 'create_private_team') {
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
