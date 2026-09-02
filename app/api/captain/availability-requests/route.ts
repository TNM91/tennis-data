import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { randomUUID } from 'node:crypto'

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
  invitedPlayers?: Array<{ playerId?: string; playerName?: string; responseToken?: string }>
  inviteMode?: 'append' | 'replace'
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
  const startedAt = Date.now()
  console.info('[api/captain/availability-requests] incoming', {
    method: request.method,
    hasAuthorization: Boolean(request.headers.get('authorization')),
  })
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) {
    console.warn('[api/captain/availability-requests] rejected before body parse', {
      durationMs: Date.now() - startedAt,
      status: auth.response.status,
    })
    return auth.response
  }

  let body: AvailabilityRequestBody
  try {
    body = await request.json() as AvailabilityRequestBody
  } catch {
    console.warn('[api/captain/availability-requests] invalid JSON body', {
      durationMs: Date.now() - startedAt,
      userId: auth.userId,
    })
    return Response.json({ ok: false, message: 'Invalid availability request.' }, { status: 400 })
  }

  const teamName = cleanAvailabilityText(body.teamName)
  const matchDate = cleanAvailabilityText(body.matchDate, 10)
  if (!teamName || !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    console.warn('[api/captain/availability-requests] missing match scope', {
      durationMs: Date.now() - startedAt,
      userId: auth.userId,
      hasTeamName: Boolean(teamName),
      matchDate,
    })
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
      responseToken: cleanAvailabilityText(player.responseToken, 80),
    }))
    .map((player) => ({
      ...player,
      // Always provide a secure per-player token. Older deployed schemas can
      // lack the database default, and a bulk lineup request has no reason to
      // depend on that default being present.
      responseToken: isUuid(player.responseToken) ? player.responseToken : randomUUID(),
    }))
    .filter((player) => player.playerName)

  if (!invitedPlayers.length) {
    console.warn('[api/captain/availability-requests] no invited players', {
      durationMs: Date.now() - startedAt,
      userId: auth.userId,
      teamName,
      matchDate,
    })
    return Response.json(
      { ok: false, message: 'Add at least one player to the potential lineup first.' },
      { status: 400 }
    )
  }

  const service = getCaptainAvailabilityServiceClient()
  const scenarioId = cleanAvailabilityText(body.scenarioId, 80)
  const existingQuery = service
    .from('captain_availability_requests')
    .select('id,request_token,invited_players_json')
    .eq('created_by', auth.userId)
    .eq('team_name', teamName)
    .eq('match_date', matchDate)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (isUuid(scenarioId)) existingQuery.eq('scenario_id', scenarioId)
  const { data: existingRows } = await existingQuery
  const existing = existingRows?.[0] as {
    id: string
    request_token: string
    invited_players_json: Array<{ playerId?: string; playerName?: string }> | null
  } | undefined
  const appendInvites = body.inviteMode === 'append'
  const existingInviteTokens = new Map<string, string>()
  if (appendInvites && existing?.id) {
    const { data: existingInviteRows, error: existingInviteError } = await service
      .from('captain_availability_request_invites')
      .select('player_id,player_name,response_token')
      .eq('request_id', existing.id)

    if (existingInviteError) {
      console.error('[api/captain/availability-requests] existing invite read failed', {
        durationMs: Date.now() - startedAt,
        userId: auth.userId,
        requestId: existing.id,
        message: existingInviteError.message,
      })
      return Response.json({ ok: false, message: 'TiQ could not reopen the saved player asks. Please try again in a moment.' }, { status: 500 })
    }

    for (const invite of existingInviteRows ?? []) {
      const key = `${cleanAvailabilityText(invite.player_id, 80)}:${cleanAvailabilityText(invite.player_name).toLowerCase()}`
      if (isUuid(invite.response_token)) existingInviteTokens.set(key, invite.response_token)
    }
  }

  const existingInvites = appendInvites && Array.isArray(existing?.invited_players_json)
    ? existing.invited_players_json
      .map((player) => {
        const playerId = cleanAvailabilityText(player.playerId, 80)
        const playerName = cleanAvailabilityText(player.playerName)
        return {
          playerId,
          playerName,
          responseToken: existingInviteTokens.get(`${playerId}:${playerName.toLowerCase()}`) || randomUUID(),
        }
      })
      .filter((player) => player.playerName)
    : []
  const requestInvitedPlayers = Array.from(
    new Map([...existingInvites, ...invitedPlayers].map((player) => [
      `${player.playerId || ''}:${player.playerName.toLowerCase()}`,
      player,
    ])).values()
  ).map((player) => ({
    ...player,
    // Existing request JSON from an earlier build can lack a response token.
    // The final row normalization protects appends as well as brand-new asks.
    responseToken: isUuid(player.responseToken) ? player.responseToken : randomUUID(),
  }))
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
    invited_players_json: requestInvitedPlayers,
    updated_at: new Date().toISOString(),
  }

  let requestId = existing?.id ?? ''
  let token = existing?.request_token ?? ''
  if (existing) {
    const { error } = await service
      .from('captain_availability_requests')
      .update(payload)
      .eq('id', existing.id)
    if (error) {
      console.error('[api/captain/availability-requests] request update failed', { durationMs: Date.now() - startedAt, userId: auth.userId, message: error.message })
      return Response.json({ ok: false, message: error.message }, { status: 500 })
    }
  } else {
    const { data, error } = await service
      .from('captain_availability_requests')
      .insert(payload)
      .select('id,request_token')
      .single()
    if (error) {
      console.error('[api/captain/availability-requests] request insert failed', { durationMs: Date.now() - startedAt, userId: auth.userId, message: error.message })
      return Response.json({ ok: false, message: error.message }, { status: 500 })
    }
    requestId = String(data.id)
    token = String(data.request_token)
  }

  const inviteRows = requestInvitedPlayers.map((player) => ({
    request_id: requestId,
    player_id: isUuid(player.playerId) ? player.playerId : null,
    player_name: player.playerName,
    response_token: player.responseToken,
    updated_at: new Date().toISOString(),
  }))
  const { error: inviteError } = await service
    .from('captain_availability_request_invites')
    .upsert(inviteRows, { onConflict: 'request_id,player_name' })
  if (inviteError) {
    console.error('[api/captain/availability-requests] invite upsert failed', { durationMs: Date.now() - startedAt, userId: auth.userId, requestId, message: inviteError.message })
    return Response.json({
      ok: false,
      message: 'TiQ could not prepare secure reply links. Please try again in a moment.',
    }, { status: 500 })
  }

  const invitedNames = new Set(requestInvitedPlayers.map((player) => player.playerName.toLowerCase()))
  const { data: currentInvites } = await service
    .from('captain_availability_request_invites')
    .select('id,player_name')
    .eq('request_id', requestId)
  const staleInviteIds = (currentInvites ?? [])
    .filter((invite) => !invitedNames.has(String(invite.player_name).toLowerCase()))
    .map((invite) => invite.id)
  if (!appendInvites && staleInviteIds.length) {
    await service
      .from('captain_availability_request_invites')
      .delete()
      .in('id', staleInviteIds)
  }

  const { data: inviteData, error: inviteReadError } = await service
    .from('captain_availability_request_invites')
    .select('player_id,player_name,response_token')
    .eq('request_id', requestId)
  if (inviteReadError) {
    console.error('[api/captain/availability-requests] invite read failed', { durationMs: Date.now() - startedAt, userId: auth.userId, requestId, message: inviteReadError.message })
    return Response.json({ ok: false, message: inviteReadError.message }, { status: 500 })
  }

  // Keep an independent, per-player copy of every link we hand to Messages.
  // Unlike the live request/invite tables, snapshots have no foreign key to a
  // request, so an accidental request replacement or cascade cannot strand a
  // player with a text that no longer opens.
  const snapshotRows = (inviteData ?? []).map((invite) => ({
    response_token: invite.response_token,
    request_id: requestId,
    created_by: auth.userId,
    player_id: isUuid(invite.player_id ?? '') ? invite.player_id : null,
    player_name: invite.player_name,
    team_name: payload.team_name,
    league_name: payload.league_name,
    flight: payload.flight,
    match_date: payload.match_date,
    opponent_team: payload.opponent_team,
    match_time: payload.match_time,
    facility: payload.facility,
    slots_json: payload.slots_json,
    invited_players_json: payload.invited_players_json,
    updated_at: new Date().toISOString(),
  }))
  const { error: snapshotError } = await service
    .from('captain_availability_link_snapshots')
    .upsert(snapshotRows, { onConflict: 'response_token' })
  if (snapshotError) {
    console.error('[api/captain/availability-requests] durable link snapshot failed', {
      durationMs: Date.now() - startedAt,
      userId: auth.userId,
      requestId,
      message: snapshotError.message,
    })
    return Response.json({
      ok: false,
      message: 'TiQ could not secure the player reply links. Please try again in a moment.',
    }, { status: 500 })
  }

  const origin = new URL(request.url).origin

  console.info('[api/captain/availability-requests] created', {
    durationMs: Date.now() - startedAt,
    userId: auth.userId,
    requestId,
    invitedPlayerCount: requestInvitedPlayers.length,
    inviteMode: body.inviteMode === 'append' ? 'append' : 'replace',
    durableSnapshotCount: snapshotRows.length,
  })

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
