import { loadReviewedTeamLinks, readReviewedTeamRooms } from '@/lib/first-party-team-scopes'
import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { loadPlayerAccess } from '@/lib/player-api-auth'
import { supabaseKey } from '@/lib/supabase-public-config'
import { inspectTeamLogoImage, validateTeamLogoDimensions } from '@/lib/team-branding'
import { saveTeamLogo } from '@/lib/team-branding-storage'
import { buildTeamRoomScopeId } from '@/lib/team-room'
import { checkTeamChatAccess } from '@/lib/team-chat-updates'

export const runtime = 'nodejs'

const json = (data: object, status: number) => accountResponse(
  { ...data, releaseScope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' },
)
const denied = (status: number) => json({ ok: false }, status)

export async function POST(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    const body = await readAccountJson(request, 360_000)
    if (!body || Object.keys(body).length !== 5) return denied(400)
    const { teamName, leagueName, flight, roomId, photo } = body
    if ([teamName, leagueName, flight, roomId].some(field => typeof field !== 'string') ||
        photo !== null && (typeof photo !== 'string' || photo.length > 350_000 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(photo))) return denied(400)

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return denied(503)
    const service = accountClient(key), owner = account.user.id
    const links = await loadReviewedTeamLinks(service, owner, readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS))
    const team = links.find(link => link.roomId === roomId && link.teamName === teamName &&
      link.leagueName === leagueName && link.flight === flight)
    if (!team?.isCaptain) return denied(403)
    const [access, membership, room] = await Promise.all([
      loadPlayerAccess(accountClient(supabaseKey, account.token), owner),
      checkTeamChatAccess(service, owner, team.roomId, false),
      service.from('internal_conversations').select('id,metadata').eq('id', team.roomId)
        .eq('related_entity_type', 'team_room').eq('related_entity_id', buildTeamRoomScopeId(team))
        .eq('status', 'open').maybeSingle(),
    ])
    if (room.error) return denied(503)
    if (!membership.ok) return denied(membership.status)
    if (!access.canUseCaptainWorkflow || room.data?.id !== team.roomId) return denied(403)

    let logo = null
    if (typeof photo === 'string') {
      const bytes = Buffer.from(photo, 'base64')
      const mimeType = 'image/jpeg'
      const dimensions = inspectTeamLogoImage(bytes, mimeType)
      if (!dimensions || validateTeamLogoDimensions(dimensions) || Math.max(dimensions.width, dimensions.height) > 512) return denied(400)
      logo = { ...dimensions, bytes, mimeType }
    }
    const status = await saveTeamLogo(service, team.roomId, room.data.metadata, logo)
    return status === 200 ? json({ ok: true, owner, roomId, hasLogo: logo !== null }, 200) : denied(status)
  } catch {
    return denied(503)
  }
}
