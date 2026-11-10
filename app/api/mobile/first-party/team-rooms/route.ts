import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { countFirstPartyChats, readFirstPartyChat, reviewedTeamOptions, writeFirstPartyChat } from '@/lib/first-party-team-chat'
import { findReviewedTeamConversation, loadReviewedTeamLinks, readReviewedTeamRooms } from '@/lib/first-party-team-scopes'
import { nativeCoachChatUnread } from '@/lib/native-coach-chat-unread'
import { supabaseKey } from '@/lib/supabase-public-config'

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
    const fields = op === 'updates' ? ['before', 'focus'] : op === 'message' ? ['message', 'view'] : []
    const allowed = ['op', ...fields, ...(['room', 'updates', 'message'].includes(op) ? scopeKeys : [])]
    const selecting = scopeKeys.some(key => params.has(key)) || op === 'updates' || op === 'message'
    if (!['room', 'teams', 'updates', 'message', 'unread'].includes(op) ||
        [...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1) ||
        selecting && scopeKeys.some(key => !params.has(key))) return denied(400)

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return denied(503)
    const service = accountClient(key), owner = account.user.id
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
    const result = await readFirstPartyChat(service, owner, selected, params)
    return result.ok ? json({ ...result, owner, teams: options }) : json(result, result.status)
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
    const approvals = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
    const teams = await loadReviewedTeamLinks(service, owner, approvals)
    const selected = teams.find(team => team.teamName === body.teamName &&
      team.leagueName === body.leagueName && team.flight === body.flight)
    if (!selected || !await findReviewedTeamConversation(service, selected)) return denied(403)
    const result = await writeFirstPartyChat(service, owner, selected.roomId, body)
    return json({ ...result, owner }, result.status)
  } catch {
    return denied(503)
  }
}
