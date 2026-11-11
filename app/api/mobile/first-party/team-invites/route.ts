import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { findReviewedTeamConversation, loadReviewedTeamLinks, readReviewedTeamRooms, resolveFirstPartyTeamRoom } from '@/lib/first-party-team-scopes'
import { actOnCaptainInvite } from '@/lib/native-captain-invites'
import { actOnNativeInvite } from '@/lib/native-team-invites'
import { nativeInviteReview } from '@/lib/native-team-invite-contract'
import { loadPlayerAccess } from '@/lib/player-api-auth'
import { supabaseKey } from '@/lib/supabase-public-config'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status: number) => accountResponse(
  { ...body, releaseScope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' },
)
const denied = (status: number) => json({ ok: false, message: 'This team invite is unavailable.' }, status)

export async function POST(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    if (new URL(request.url).search) return denied(400)
    const body = await readAccountJson(request, 4096)
    if (!body) return denied(400)
    const managing = body.action === 'list' || body.action === 'create' || body.action === 'revoke'
    if (!managing && body.action !== 'preview' && body.action !== 'join') return denied(400)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return denied(503)
    const approvals = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
    const service = accountClient(key), owner = account.user.id
    if (managing) {
      const team = (await loadReviewedTeamLinks(service, owner, approvals)).find(link =>
        link.teamName === body.teamName && link.leagueName === body.leagueName && link.flight === body.flight)
      if (!team?.isCaptain || !await findReviewedTeamConversation(service, team)) return denied(403)
      const access = await loadPlayerAccess(accountClient(supabaseKey, account.token), owner)
      if (!access.canUseCaptainWorkflow) {
        return json({ ok: false, message: 'Captain access is required for this team.' }, 403)
      }
      const result = await actOnCaptainInvite(service, owner, body, team.roomId)
      return json({ ...result, owner }, result.status)
    }
    const preview = await actOnNativeInvite(service, owner, { action: 'preview', token: body.token })
    if (!preview.ok || !('review' in preview)) return denied(preview.status)
    const review = nativeInviteReview(preview.review)
    const team = await resolveFirstPartyTeamRoom(service, approvals, review)
    if (!team || team.roomId !== review.roomId || !await findReviewedTeamConversation(service, team)) return denied(404)
    const hasLink = async () => (await loadReviewedTeamLinks(service, owner, approvals)).some(link => link.roomId === team.roomId)
    if (review.alreadyJoined && !await hasLink()) return denied(403)
    if (body.action === 'preview') return json({ ...preview, owner, review: { ...preview.review, leagueLabel: team.leagueLabel } }, 200)

    // Check the exact reviewed fingerprint before the RPC checks it atomically on join.
    const submitted = (body.expected as { invite?: Record<string, unknown> } | undefined)?.invite
    const expected = Object.entries(review.expected.invite)
    if (!submitted || Array.isArray(submitted) || Object.keys(submitted).length !== expected.length ||
        expected.some(([key, value]) => submitted[key] !== value)) return denied(409)
    const result = await actOnNativeInvite(service, owner, body)
    if (!result.ok) return json(result, result.status)
    if (!('roomId' in result) || result.roomId !== team.roomId || !await hasLink()) return denied(403)
    return json({ ...result, owner }, result.status)
  } catch {
    return denied(503)
  }
}
