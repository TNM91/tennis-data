import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import {
  cleanAvailabilityText,
  getCaptainAvailabilityServiceClient,
  isUuid,
} from '@/lib/captain-availability-request-server'
import { canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'

export const runtime = 'nodejs'

type AvailabilityRequestBody = {
  scenarioId?: string
  teamName?: string
  leagueName?: string
  flight?: string
  matchDate?: string
  opponentTeam?: string
  matchTime?: string
  facility?: string
  slots?: unknown
  invitedPlayers?: Array<{ playerId?: string; playerName?: string }>
}

export async function GET(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const requestId = cleanAvailabilityText(url.searchParams.get('requestId'), 80)
  const scenarioId = cleanAvailabilityText(url.searchParams.get('scenarioId'), 80)
  const teamName = cleanAvailabilityText(url.searchParams.get('teamName'))
  const matchDate = cleanAvailabilityText(url.searchParams.get('matchDate'), 10)
  if (!isUuid(requestId) && !isUuid(scenarioId) && (!teamName || !/^\d{4}-\d{2}-\d{2}$/.test(matchDate))) {
    return Response.json({ ok: true, request: null, invites: [], responses: [] })
  }

  const service = getCaptainAvailabilityServiceClient()
  let requestQuery = service
    .from('captain_availability_requests')
    .select('id,request_token,created_by,scenario_id,team_name,league_name,flight,match_date,opponent_team,match_time,facility,slots_json,invited_players_json,updated_at')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)

  requestQuery = isUuid(requestId)
    ? requestQuery.eq('id', requestId)
    : isUuid(scenarioId)
      ? requestQuery.eq('created_by', auth.userId).eq('scenario_id', scenarioId)
      : requestQuery.eq('created_by', auth.userId).eq('team_name', teamName).eq('match_date', matchDate)

  const { data: requestRows, error: requestError } = await requestQuery
  if (requestError) return Response.json({ ok: false, message: requestError.message }, { status: 500 })
  const row = requestRows?.[0]
  if (!row) return Response.json({ ok: true, request: null, invites: [], responses: [] })
  if (row.created_by !== auth.userId && !await canManageSharedAvailabilityRequest(service, auth.userId, row)) {
    return Response.json({ ok: false, message: 'This availability request is not linked to one of your teams.' }, { status: 403 })
  }

  const [invitesResult, responsesResult] = await Promise.all([
    service
      .from('captain_availability_request_invites')
      .select('player_id,player_name,response_token')
      .eq('request_id', row.id)
      .order('created_at', { ascending: true }),
    service
      .from('captain_availability_request_responses')
      .select('player_id,player_name,match_date,status,notes,responded_at')
      .eq('request_id', row.id)
      .order('responded_at', { ascending: false }),
  ])
  if (invitesResult.error) return Response.json({ ok: false, message: invitesResult.error.message }, { status: 500 })
  if (responsesResult.error) return Response.json({ ok: false, message: responsesResult.error.message }, { status: 500 })

  const origin = url.origin
  return Response.json({
    ok: true,
    request: {
      id: row.id,
      scenarioId: row.scenario_id,
      teamName: row.team_name,
      leagueName: row.league_name,
      flight: row.flight,
      matchDate: row.match_date,
      opponentTeam: row.opponent_team,
      matchTime: row.match_time,
      facility: row.facility,
      slots: row.slots_json,
      invitedPlayers: row.invited_players_json,
      requestUrl: `${origin}/availability/${encodeURIComponent(row.request_token)}`,
      updatedAt: row.updated_at,
    },
    invites: (invitesResult.data ?? []).map((invite) => ({
      playerId: invite.player_id ?? '',
      playerName: invite.player_name,
      requestUrl: `${origin}/availability/${encodeURIComponent(invite.response_token)}`,
    })),
    responses: responsesResult.data ?? [],
  })
}

async function canManageSharedAvailabilityRequest(
  service: ReturnType<typeof getCaptainAvailabilityServiceClient>,
  userId: string,
  request: { team_name: string; league_name: string; flight: string },
) {
  const { data } = await service
    .from('team_profile_links')
    .select('league_name,flight,team_role,team_roles')
    .eq('profile_user_id', userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(request.team_name))
    .eq('status', 'accepted')

  return (data ?? []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return normalizeTeamRoomKey(link.league_name) === normalizeTeamRoomKey(request.league_name)
      && normalizeTeamRoomKey(link.flight) === normalizeTeamRoomKey(request.flight)
      && canManageTeamRoom(roles)
  })
}

export async function POST(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  let body: AvailabilityRequestBody
  try {
    body = await request.json() as AvailabilityRequestBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid availability request.' }, { status: 400 })
  }

  const teamName = cleanAvailabilityText(body.teamName)
  const matchDate = cleanAvailabilityText(body.matchDate, 10)
  if (!teamName || !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    return Response.json(
      { ok: false, message: 'Choose a team and scheduled match before confirming availability.' },
      { status: 400 }
    )
  }

  const invitedPlayers = (body.invitedPlayers ?? [])
    .slice(0, 40)
    .map((player) => ({
      playerId: cleanAvailabilityText(player.playerId, 80),
      playerName: cleanAvailabilityText(player.playerName),
    }))
    .filter((player) => player.playerName)

  if (!invitedPlayers.length) {
    return Response.json(
      { ok: false, message: 'Add at least one player to the potential lineup first.' },
      { status: 400 }
    )
  }

  const service = getCaptainAvailabilityServiceClient()
  const scenarioId = cleanAvailabilityText(body.scenarioId, 80)
  const payload = {
    created_by: auth.userId,
    scenario_id: isUuid(scenarioId) ? scenarioId : null,
    team_name: teamName,
    league_name: cleanAvailabilityText(body.leagueName),
    flight: cleanAvailabilityText(body.flight),
    match_date: matchDate,
    opponent_team: cleanAvailabilityText(body.opponentTeam),
    match_time: cleanAvailabilityText(body.matchTime, 80),
    facility: cleanAvailabilityText(body.facility, 240),
    slots_json: Array.isArray(body.slots) ? body.slots : [],
    invited_players_json: invitedPlayers,
    updated_at: new Date().toISOString(),
  }

  const existingQuery = service
    .from('captain_availability_requests')
    .select('id,request_token')
    .eq('created_by', auth.userId)
    .eq('team_name', teamName)
    .eq('match_date', matchDate)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (payload.scenario_id) existingQuery.eq('scenario_id', payload.scenario_id)
  const { data: existingRows } = await existingQuery
  const existing = existingRows?.[0] as { id: string; request_token: string } | undefined

  let requestId = existing?.id ?? ''
  let token = existing?.request_token ?? ''
  if (existing) {
    const { error } = await service
      .from('captain_availability_requests')
      .update(payload)
      .eq('id', existing.id)
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  } else {
    const { data, error } = await service
      .from('captain_availability_requests')
      .insert(payload)
      .select('id,request_token')
      .single()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    requestId = String(data.id)
    token = String(data.request_token)
  }

  const inviteRows = invitedPlayers.map((player) => ({
    request_id: requestId,
    player_id: isUuid(player.playerId) ? player.playerId : null,
    player_name: player.playerName,
    updated_at: new Date().toISOString(),
  }))
  const { error: inviteError } = await service
    .from('captain_availability_request_invites')
    .upsert(inviteRows, { onConflict: 'request_id,player_name' })
  if (inviteError) return Response.json({ ok: false, message: inviteError.message }, { status: 500 })

  const invitedNames = new Set(invitedPlayers.map((player) => player.playerName.toLowerCase()))
  const { data: currentInvites } = await service
    .from('captain_availability_request_invites')
    .select('id,player_name')
    .eq('request_id', requestId)
  const staleInviteIds = (currentInvites ?? [])
    .filter((invite) => !invitedNames.has(String(invite.player_name).toLowerCase()))
    .map((invite) => invite.id)
  if (staleInviteIds.length) {
    await service
      .from('captain_availability_request_invites')
      .delete()
      .in('id', staleInviteIds)
  }

  const { data: inviteData, error: inviteReadError } = await service
    .from('captain_availability_request_invites')
    .select('player_id,player_name,response_token')
    .eq('request_id', requestId)
  if (inviteReadError) return Response.json({ ok: false, message: inviteReadError.message }, { status: 500 })

  const origin = new URL(request.url).origin

  return Response.json({
    ok: true,
    requestId,
    token,
    requestUrl: `${origin}/availability/${encodeURIComponent(token)}`,
    playerRequestUrls: (inviteData ?? []).map((invite) => ({
      playerId: invite.player_id ?? '',
      playerName: invite.player_name,
      requestUrl: `${origin}/availability/${encodeURIComponent(invite.response_token)}`,
    })),
  })
}
