import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { getCaptainAvailabilityServiceClient, cleanAvailabilityText } from '@/lib/captain-availability-request-server'
import { normalizeTeamName } from '@/lib/captain-formatters'
import {
  captainLineupReviewPath,
  captainLineupReviewReturnPath,
  sanitizeCaptainLineupReviewRoster,
  sanitizeCaptainLineupReviewSlots,
} from '@/lib/captain-lineup-review'
import { canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const teamName = cleanAvailabilityText(body?.teamName, 160)
  const leagueName = cleanAvailabilityText(body?.leagueName, 160)
  const flight = cleanAvailabilityText(body?.flight, 120)
  const matchDate = cleanAvailabilityText(body?.matchDate, 10)
  const slots = sanitizeCaptainLineupReviewSlots(body?.slots)
  const roster = sanitizeCaptainLineupReviewRoster(body?.roster)
  if (!teamName || !slots.length || !roster.length) {
    return Response.json({ ok: false, message: 'Choose a team and add players before asking for a lineup review.' }, { status: 400 })
  }
  if (matchDate && !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    return Response.json({ ok: false, message: 'Choose a valid match date before asking for a lineup review.' }, { status: 400 })
  }

  const service = getCaptainAvailabilityServiceClient()
  const { data: teamLinks, error: teamLinksError } = await service
    .from('team_profile_links')
    .select('team_role,team_roles')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(teamName))
    .eq('status', 'accepted')
    .limit(10)
  if (teamLinksError) {
    return Response.json({ ok: false, message: 'Captain team access could not be checked.' }, { status: 500 })
  }
  const canManage = auth.isAdmin || (teamLinks ?? []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return canManageTeamRoom(roles)
  })
  if (!canManage) {
    return Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 })
  }

  const rosterKeys = new Set(roster.flatMap((player) => [player.id, normalizeTeamName(player.name)]).filter(Boolean))
  const hasUnknownAssignedPlayer = slots.some((slot) => slot.players.some((player) => {
    if (!player.playerId && !player.playerName) return false
    return !rosterKeys.has(player.playerId) && !rosterKeys.has(normalizeTeamName(player.playerName))
  }))
  if (hasUnknownAssignedPlayer) {
    return Response.json({ ok: false, message: 'Refresh the roster before sharing this lineup.' }, { status: 400 })
  }

  const { data, error } = await service
    .from('captain_lineup_reviews')
    .insert({
      created_by: auth.userId,
      scenario_id: cleanAvailabilityText(body?.scenarioId, 80) || null,
      team_name: teamName,
      league_name: leagueName,
      flight,
      match_date: matchDate || null,
      opponent_team: cleanAvailabilityText(body?.opponentTeam, 160),
      match_time: cleanAvailabilityText(body?.matchTime, 80),
      facility: cleanAvailabilityText(body?.facility, 240),
      slots_json: slots,
      roster_json: roster,
    })
    .select('review_token,expires_at')
    .single()
  if (error || !data?.review_token) {
    return Response.json({ ok: false, message: error?.message || 'The private review link could not be created.' }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  return Response.json({
    ok: true,
    reviewUrl: `${origin}${captainLineupReviewPath(data.review_token)}`,
    captainUrl: `${origin}${captainLineupReviewReturnPath(data.review_token)}`,
    expiresAt: data.expires_at,
  })
}
