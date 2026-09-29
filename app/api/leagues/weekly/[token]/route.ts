import { cleanAvailabilityText, getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
import { normalizeLeagueWeeklySettings, type LeagueWeeklyCourt } from '@/lib/league-weekly-format'

export const runtime = 'nodejs'

type WeeklySessionRow = {
  id: string
  league_id: string
  play_on: string
  response_deadline: string | null
  status: string
  roster: unknown
  assignments: unknown
}

async function loadWeeklySession(token: string) {
  if (!isUuid(token)) return { ok: false as const, response: Response.json({ ok: false, message: 'This weekly league link is invalid.' }, { status: 404 }) }
  const service = getCaptainAvailabilityServiceClient()
  const { data: session, error } = await service
    .from('tiq_league_weekly_sessions')
    .select('id,league_id,play_on,response_deadline,status,roster,assignments')
    .eq('public_token', token)
    .maybeSingle()
  if (error || !session) return { ok: false as const, response: Response.json({ ok: false, message: 'This weekly league link is no longer available.' }, { status: 404 }) }
  const { data: league, error: leagueError } = await service
    .from('tiq_leagues')
    .select('league_name,photo_url,default_facility,schedule_time_zone,players,weekly_settings')
    .eq('id', session.league_id)
    .maybeSingle()
  if (leagueError || !league) return { ok: false as const, response: Response.json({ ok: false, message: 'This league could not be opened.' }, { status: 404 }) }
  return { ok: true as const, service, session: session as WeeklySessionRow, league }
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const loaded = await loadWeeklySession(token)
  if (!loaded.ok) return loaded.response
  const assignments = Array.isArray(loaded.session.assignments) ? loaded.session.assignments as LeagueWeeklyCourt[] : []
  const published = ['published', 'completed'].includes(loaded.session.status)
  const { data: results } = published
    ? await loaded.service.from('tiq_league_weekly_set_results').select('court_number,set_number,side_a_games,side_b_games,submitted_by_name').eq('session_id', loaded.session.id).order('court_number').order('set_number')
    : { data: [] }

  return Response.json({
    ok: true,
    league: {
      name: loaded.league.league_name,
      logoUrl: loaded.league.photo_url,
      facility: loaded.league.default_facility,
      timeZone: loaded.league.schedule_time_zone,
      players: Array.isArray(loaded.league.players) ? loaded.league.players : [],
      weeklySettings: normalizeLeagueWeeklySettings(loaded.league.weekly_settings),
    },
    week: {
      playOn: loaded.session.play_on,
      responseDeadline: loaded.session.response_deadline,
      status: loaded.session.status,
      roster: published && Array.isArray(loaded.session.roster) ? loaded.session.roster : [],
      assignments: published ? assignments : [],
      results: results || [],
    },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const loaded = await loadWeeklySession(token)
  if (!loaded.ok) return loaded.response
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'That weekly update is invalid.' }, { status: 400 })
  }

  const playerName = cleanAvailabilityText(body.playerName)
  const knownPlayers = Array.isArray(loaded.league.players) ? loaded.league.players.map(String) : []
  const canonicalPlayerName = knownPlayers.find((name) => name.toLowerCase() === playerName.toLowerCase()) || ''
  if (!canonicalPlayerName) return Response.json({ ok: false, message: 'Choose your name from the league roster.' }, { status: 400 })

  if (body.action === 'rsvp') {
    if (loaded.session.status !== 'collecting') return Response.json({ ok: false, message: 'The roster is already confirmed for this week.' }, { status: 409 })
    const responseStatus = body.responseStatus === 'out' ? 'out' : body.responseStatus === 'in' ? 'in' : ''
    if (!responseStatus) return Response.json({ ok: false, message: 'Choose in or out for this week.' }, { status: 400 })
    const { error } = await loaded.service.from('tiq_league_weekly_responses').upsert({
      session_id: loaded.session.id,
      player_name: canonicalPlayerName,
      response_status: responseStatus,
      note: cleanAvailabilityText(body.note, 500),
      positive_share: cleanAvailabilityText(body.positiveShare, 800),
      responded_at: new Date().toISOString(),
    }, { onConflict: 'session_id,player_name' })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, message: `You are marked ${responseStatus} for this week.` })
  }

  if (body.action === 'score') {
    if (!['published', 'completed'].includes(loaded.session.status)) return Response.json({ ok: false, message: 'Court assignments are not published yet.' }, { status: 409 })
    const assignments = Array.isArray(loaded.session.assignments) ? loaded.session.assignments as LeagueWeeklyCourt[] : []
    const courtNumber = Number(body.courtNumber)
    const setNumber = Number(body.setNumber)
    const court = assignments.find((item) => item.courtNumber === courtNumber)
    const set = court?.sets.find((item) => item.setNumber === setNumber)
    if (!court || !set || !court.players.includes(canonicalPlayerName)) return Response.json({ ok: false, message: 'Choose a set from your assigned court.' }, { status: 400 })
    const sideAGames = Number(body.sideAGames)
    const sideBGames = Number(body.sideBGames)
    if (![sideAGames, sideBGames].every((score) => Number.isInteger(score) && score >= 0 && score <= 99) || sideAGames === sideBGames) {
      return Response.json({ ok: false, message: 'Enter a completed set score with one winning side.' }, { status: 400 })
    }
    const { error } = await loaded.service.from('tiq_league_weekly_set_results').upsert({
      session_id: loaded.session.id,
      court_number: courtNumber,
      set_number: setNumber,
      side_a_players: set.sideA,
      side_b_players: set.sideB,
      side_a_games: sideAGames,
      side_b_games: sideBGames,
      submitted_by_name: canonicalPlayerName,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'session_id,court_number,set_number' })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    const positiveShare = cleanAvailabilityText(body.positiveShare, 800)
    if (positiveShare) {
      await loaded.service.from('tiq_league_weekly_responses').update({ positive_share: positiveShare }).eq('session_id', loaded.session.id).eq('player_name', canonicalPlayerName)
    }
    return Response.json({ ok: true, message: `Court ${courtNumber}, set ${setNumber} is saved.` })
  }

  return Response.json({ ok: false, message: 'Choose a weekly league action.' }, { status: 400 })
}
