import {
  cleanAvailabilityText,
  getCaptainAvailabilityServiceClient,
  isUuid,
} from '@/lib/captain-availability-request-server'

export const runtime = 'nodejs'

type InvitedPlayer = { playerId: string; playerName: string }
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
    service
      .from('captain_availability_request_responses')
      .select('player_id,player_name,match_date,status,notes,responded_at')
      .eq('request_id', row.id)
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
  const requestedPlayerId = cleanAvailabilityText(body.playerId, 80)
  const requestedPlayerName = cleanAvailabilityText(body.playerName)
  const player = invited.find((candidate) =>
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
  const responseRows = responses.map((response) => ({
    request_id: row.id,
    player_id: isUuid(player.playerId) ? player.playerId : null,
    player_name: player.playerName,
    match_date: response.matchDate,
    status: response.status,
    notes,
    responded_at: new Date().toISOString(),
  }))
  const { error: responseError } = await service
    .from('captain_availability_request_responses')
    .upsert(responseRows, { onConflict: 'request_id,player_name,match_date' })
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

  return Response.json({ ok: true, saved: responses.length })
}

async function loadRequest(service: ReturnType<typeof getCaptainAvailabilityServiceClient>, token: string) {
  if (!isUuid(token)) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'This availability link is invalid.' }, { status: 404 }),
    }
  }
  const { data, error } = await service
    .from('captain_availability_requests')
    .select('id,team_name,league_name,flight,match_date,opponent_team,match_time,facility,slots_json,invited_players_json,expires_at')
    .eq('request_token', token)
    .maybeSingle()
  if (error || !data || new Date(data.expires_at).getTime() < Date.now()) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'This availability link is no longer active.' }, { status: 404 }),
    }
  }
  return { ok: true as const, row: data }
}
