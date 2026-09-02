import {
  cleanAvailabilityText,
  getCaptainAvailabilityServiceClient,
  isUuid,
} from '@/lib/captain-availability-request-server'
import { buildCaptainReplyNotification, findCaptainReplyCourt } from '@/lib/captain-reply-alert'
import { sendTeamRoomPush } from '@/lib/team-room-push-server'

export const runtime = 'nodejs'

type InvitedPlayer = { playerId: string; playerName: string }
type AvailabilityRequestRow = {
  id: string
  created_by: string | null
  team_name: string
  league_name: string
  flight: string
  match_date: string
  opponent_team: string
  match_time: string
  facility: string
  slots_json: unknown
  invited_players_json: unknown
  expires_at: string
}
type AvailabilitySubmission = {
  playerId?: string
  playerName?: string
  notes?: string
  responses?: Array<{ matchDate?: string; status?: string }>
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const service = getCaptainAvailabilityServiceClient()
  const loaded = await loadRequest(service, token)
  if (!loaded.ok) return loaded.response

  const row = loaded.row
  const [matchesResult, responsesResult] = await Promise.all([
    service
      .from('matches')
      .select('id,match_date,match_time,facility,home_team,away_team')
      .eq('league_name', row.league_name)
      .eq('flight', row.flight)
      .is('line_number', null)
      .gte('match_date', row.match_date)
      .order('match_date', { ascending: true })
      .limit(30),
    loaded.source === 'live'
      ? service
        .from('captain_availability_request_responses')
        .select('player_id,player_name,match_date,status,notes,responded_at')
        .eq('request_id', row.id)
        .order('match_date', { ascending: true })
      : service
        .from('captain_availability_link_snapshot_responses')
        .select('player_id,player_name,match_date,status,notes,responded_at')
        .eq('response_token', loaded.responseToken || '')
        .order('match_date', { ascending: true }),
  ])

  if (matchesResult.error) {
    return Response.json({ ok: false, message: matchesResult.error.message }, { status: 500 })
  }
  if (responsesResult.error) {
    return Response.json({ ok: false, message: responsesResult.error.message }, { status: 500 })
  }

  const matches = (matchesResult.data ?? [])
    .filter((match) => match.home_team === row.team_name || match.away_team === row.team_name)
    .map((match) => ({
      id: match.id,
      matchDate: match.match_date,
      matchTime: match.match_time ?? '',
      facility: match.facility ?? '',
      opponent: match.home_team === row.team_name ? match.away_team ?? '' : match.home_team ?? '',
    }))
  if (!matches.some((match) => match.matchDate === row.match_date)) {
    matches.unshift({
      id: `request-${row.id}`,
      matchDate: row.match_date,
      matchTime: row.match_time,
      facility: row.facility,
      opponent: row.opponent_team,
    })
  }

  return Response.json({
    ok: true,
    lockedPlayer: loaded.lockedPlayer,
    request: {
      teamName: row.team_name,
      leagueName: row.league_name,
      flight: row.flight,
      matchDate: row.match_date,
      opponentTeam: row.opponent_team,
      matchTime: row.match_time,
      facility: row.facility,
      slots: row.slots_json,
      invitedPlayers: row.invited_players_json,
    },
    matches,
    responses: responsesResult.data ?? [],
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  let body: AvailabilitySubmission
  try {
    body = await request.json() as AvailabilitySubmission
  } catch {
    return Response.json({ ok: false, message: 'Invalid availability response.' }, { status: 400 })
  }

  const service = getCaptainAvailabilityServiceClient()
  const loaded = await loadRequest(service, token)
  if (!loaded.ok) return loaded.response
  const row = loaded.row
  const invited = (Array.isArray(row.invited_players_json) ? row.invited_players_json : []) as InvitedPlayer[]
  const requestedPlayerId = loaded.lockedPlayer?.playerId || cleanAvailabilityText(body.playerId, 80)
  const requestedPlayerName = loaded.lockedPlayer?.playerName || cleanAvailabilityText(body.playerName)
  const player = loaded.lockedPlayer ?? invited.find((candidate) =>
    requestedPlayerId
      ? candidate.playerId === requestedPlayerId
      : candidate.playerName.toLowerCase() === requestedPlayerName.toLowerCase()
  )
  if (!player) {
    return Response.json({ ok: false, message: 'Choose your name from this lineup.' }, { status: 400 })
  }

  const allowedDatesResult = await service
    .from('matches')
    .select('match_date,home_team,away_team')
    .eq('league_name', row.league_name)
    .eq('flight', row.flight)
    .is('line_number', null)
    .gte('match_date', row.match_date)
    .limit(40)
  const allowedDates = new Set(
    (allowedDatesResult.data ?? [])
      .filter((match) => match.home_team === row.team_name || match.away_team === row.team_name)
      .map((match) => String(match.match_date))
  )
  allowedDates.add(row.match_date)

  const responses = (body.responses ?? [])
    .slice(0, 30)
    .map((response) => ({
      matchDate: cleanAvailabilityText(response.matchDate, 10),
      status: cleanAvailabilityText(response.status, 20),
    }))
    .filter((response) =>
      allowedDates.has(response.matchDate) &&
      ['available', 'maybe', 'unavailable'].includes(response.status)
    )
  if (!responses.length) {
    return Response.json({ ok: false, message: 'Set availability for at least one match.' }, { status: 400 })
  }

  const notes = cleanAvailabilityText(body.notes, 500) || null
  const previousResponsesResult = loaded.source === 'live'
    ? await service
      .from('captain_availability_request_responses')
      .select('match_date,status')
      .eq('request_id', row.id)
      .eq('player_name', player.playerName)
      .in('match_date', responses.map((response) => response.matchDate))
    : await service
      .from('captain_availability_link_snapshot_responses')
      .select('match_date,status')
      .eq('response_token', loaded.responseToken || '')
      .eq('player_name', player.playerName)
      .in('match_date', responses.map((response) => response.matchDate))
  const previousResponses = previousResponsesResult.data
  const previousByDate = new Map(
    (previousResponses ?? []).map((response) => [String(response.match_date), String(response.status)])
  )
  const hasChangedResponse = responses.some(
    (response) => previousByDate.get(response.matchDate) !== response.status
  )
  const responseRows = responses.map((response) => ({
    player_id: isUuid(player.playerId) ? player.playerId : null,
    player_name: player.playerName,
    match_date: response.matchDate,
    status: response.status,
    notes,
    responded_at: new Date().toISOString(),
  }))
  const responseResult = loaded.source === 'live'
    ? await service
      .from('captain_availability_request_responses')
      .upsert(responseRows.map((response) => ({ ...response, request_id: row.id })), { onConflict: 'request_id,player_name,match_date' })
    : await service
      .from('captain_availability_link_snapshot_responses')
      .upsert(responseRows.map((response) => ({ ...response, response_token: loaded.responseToken })), { onConflict: 'response_token,match_date' })
  const responseError = responseResult.error
  if (responseError) {
    return Response.json({ ok: false, message: responseError.message }, { status: 500 })
  }

  if (isUuid(player.playerId)) {
    const lineupRows = responses.map((response) => ({
      match_date: response.matchDate,
      team_name: row.team_name,
      league_name: row.league_name || null,
      flight: row.flight || null,
      player_id: player.playerId,
      status: response.status === 'maybe' ? 'limited' : response.status,
      notes,
    }))
    await service
      .from('lineup_availability')
      .upsert(lineupRows, { onConflict: 'match_date,team_name,player_id' })
  }

  if (hasChangedResponse) {
    const primaryResponse = responses.find((response) => response.matchDate === row.match_date) ?? responses[0]
    const teamRoomCard = loaded.source === 'live'
      ? await findTeamRoomAvailabilityCard(service, row.id)
      : null
    const courtLabel = findCaptainReplyCourt(row.slots_json, {
      playerId: player.playerId,
      playerName: player.playerName,
    })
    const notification = buildCaptainReplyNotification({
      playerName: player.playerName,
      status: primaryResponse.status,
      teamName: row.team_name,
      leagueName: row.league_name,
      flight: row.flight,
      matchDate: primaryResponse.matchDate,
      opponentTeam: row.opponent_team,
      teamRoomMessageId: teamRoomCard?.id,
      availabilityRequestId: loaded.source === 'live' ? row.id : '',
      courtLabel,
    })
    const recipientIds = new Set(row.created_by ? [row.created_by] : [])
    if (teamRoomCard?.conversation_id) {
      const { data: participants } = await service
        .from('internal_conversation_participants')
        .select('profile_id,participant_role,muted')
        .eq('conversation_id', teamRoomCard.conversation_id)
        .eq('participant_role', 'coordinator')
      for (const participant of participants ?? []) {
        if (participant.muted !== true && participant.profile_id) recipientIds.add(String(participant.profile_id))
      }
    }
    const recipients = Array.from(recipientIds)
    await service.from('internal_notifications').insert(recipients.map((recipientId) => ({
      recipient_profile_id: recipientId,
      actor_user_id: null,
      notification_type: 'system',
      conversation_id: teamRoomCard?.conversation_id || null,
      ...notification,
    })))
    await sendTeamRoomPush(service, recipients, {
      title: notification.title,
      body: notification.body,
      href: notification.href,
      tag: `captain-availability-${row.id}`,
    })
  }

  return Response.json({ ok: true, saved: responses.length })
}

async function findTeamRoomAvailabilityCard(
  service: ReturnType<typeof getCaptainAvailabilityServiceClient>,
  availabilityRequestId: string,
) {
  const { data } = await service
    .from('internal_messages')
    .select('id,conversation_id')
    .contains('metadata', { teamRoomCard: true, availabilityRequestId })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function loadRequest(service: ReturnType<typeof getCaptainAvailabilityServiceClient>, token: string) {
  if (!isUuid(token)) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'This availability link is invalid.' }, { status: 404 }),
    }
  }
  const select = 'id,created_by,team_name,league_name,flight,match_date,opponent_team,match_time,facility,slots_json,invited_players_json,expires_at'
  const { data, error } = await service
    .from('captain_availability_requests')
    .select(select)
    .eq('request_token', token)
    .maybeSingle()
  if (error) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: error.message }, { status: 500 }),
    }
  }
  if (data && new Date(data.expires_at).getTime() >= Date.now()) {
    return { ok: true as const, row: data as AvailabilityRequestRow, lockedPlayer: null, source: 'live' as const } satisfies { ok: true; row: AvailabilityRequestRow; lockedPlayer: InvitedPlayer | null; source: 'live' }
  }

  const { data: invite, error: inviteError } = await service
    .from('captain_availability_request_invites')
    .select('request_id,player_id,player_name')
    .eq('response_token', token)
    .maybeSingle()
  if (inviteError) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: inviteError.message }, { status: 500 }),
    }
  }
  if (!invite) {
    return loadSnapshotRequest(service, token)
  }
  const { data: invitedRequest, error: invitedRequestError } = await service
    .from('captain_availability_requests')
    .select(select)
    .eq('id', invite.request_id)
    .maybeSingle()
  if (invitedRequestError || !invitedRequest || new Date(invitedRequest.expires_at).getTime() < Date.now()) {
    return loadSnapshotRequest(service, token)
  }
  return {
    ok: true as const,
    row: invitedRequest as AvailabilityRequestRow,
    lockedPlayer: {
      playerId: invite.player_id ?? '',
      playerName: invite.player_name,
    },
    source: 'live' as const,
  }
}

async function loadSnapshotRequest(
  service: ReturnType<typeof getCaptainAvailabilityServiceClient>,
  token: string,
) {
  const { data: snapshot, error } = await service
    .from('captain_availability_link_snapshots')
    .select('request_id,created_by,player_id,player_name,team_name,league_name,flight,match_date,opponent_team,match_time,facility,slots_json,invited_players_json,expires_at')
    .eq('response_token', token)
    .maybeSingle()
  if (error) {
    console.error('[api/captain/availability-requests/token] snapshot lookup failed', { message: error.message })
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'This availability link could not be opened. Please try again.' }, { status: 500 }),
    }
  }
  if (!snapshot || new Date(snapshot.expires_at).getTime() < Date.now()) {
    console.info('[api/captain/availability-requests/token] inactive link', { token })
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'This availability link is no longer active. Ask your captain to send a fresh one.' }, { status: 404 }),
    }
  }

  return {
    ok: true as const,
    row: {
      id: snapshot.request_id || `snapshot-${token}`,
      created_by: snapshot.created_by,
      team_name: snapshot.team_name,
      league_name: snapshot.league_name,
      flight: snapshot.flight,
      match_date: snapshot.match_date,
      opponent_team: snapshot.opponent_team,
      match_time: snapshot.match_time,
      facility: snapshot.facility,
      slots_json: snapshot.slots_json,
      invited_players_json: snapshot.invited_players_json,
      expires_at: snapshot.expires_at,
    },
    lockedPlayer: {
      playerId: snapshot.player_id ?? '',
      playerName: snapshot.player_name,
    },
    source: 'snapshot' as const,
    responseToken: token,
  } satisfies { ok: true; row: AvailabilityRequestRow; lockedPlayer: InvitedPlayer; source: 'snapshot'; responseToken: string }
}
