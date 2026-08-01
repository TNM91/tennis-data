import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import {
  cleanAvailabilityText,
  getCaptainAvailabilityServiceClient,
  isUuid,
} from '@/lib/captain-availability-request-server'

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
      .select('request_token')
      .single()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    token = String(data.request_token)
  }

  return Response.json({
    ok: true,
    token,
    requestUrl: `${new URL(request.url).origin}/availability/${encodeURIComponent(token)}`,
  })
}
