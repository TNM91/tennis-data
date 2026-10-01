import { cleanAvailabilityText, getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
import { normalizeLeagueWeeklySettings, validateLeagueWeeklySetScore, type LeagueWeeklyCourt } from '@/lib/league-weekly-format'
import { deriveLeagueWeeklyOfficialScore, type LeagueWeeklyScoreSubmission } from '@/lib/league-weekly-intelligence'

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
    ? await loaded.service.from('tiq_league_weekly_set_results').select('court_number,set_number,side_a_games,side_b_games,submitted_by_name,review_status').eq('session_id', loaded.session.id).order('court_number').order('set_number')
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
    const scoreValidation = validateLeagueWeeklySetScore(sideAGames, sideBGames)
    if (!scoreValidation.valid) return Response.json({ ok: false, message: scoreValidation.message }, { status: 400 })
    const submittedAt = new Date().toISOString()
    const { error: submissionError } = await loaded.service.from('tiq_league_weekly_score_submissions').upsert({
      session_id: loaded.session.id,
      court_number: courtNumber,
      set_number: setNumber,
      side_a_games: sideAGames,
      side_b_games: sideBGames,
      submitted_by_name: canonicalPlayerName,
      submitted_at: submittedAt,
    }, { onConflict: 'session_id,court_number,set_number,submitted_by_name' })
    if (submissionError) return Response.json({ ok: false, message: submissionError.message }, { status: 500 })
    const [{ data: scoreSubmissions, error: submissionsError }, { data: existingResult }] = await Promise.all([
      loaded.service.from('tiq_league_weekly_score_submissions').select('court_number,set_number,side_a_games,side_b_games,submitted_by_name,submitted_at').eq('session_id', loaded.session.id).eq('court_number', courtNumber).eq('set_number', setNumber),
      loaded.service.from('tiq_league_weekly_set_results').select('review_status').eq('session_id', loaded.session.id).eq('court_number', courtNumber).eq('set_number', setNumber).maybeSingle(),
    ])
    if (submissionsError) return Response.json({ ok: false, message: submissionsError.message }, { status: 500 })
    const official = deriveLeagueWeeklyOfficialScore(((scoreSubmissions || []) as Array<{ court_number: number; set_number: number; side_a_games: number; side_b_games: number; submitted_by_name: string; submitted_at: string }>).map((submission) => ({
      courtNumber: submission.court_number,
      setNumber: submission.set_number,
      sideAGames: submission.side_a_games,
      sideBGames: submission.side_b_games,
      submittedByName: submission.submitted_by_name,
      submittedAt: submission.submitted_at,
    } satisfies LeagueWeeklyScoreSubmission)))
    if (!official) return Response.json({ ok: false, message: 'That score submission could not be reviewed.' }, { status: 500 })
    const ownerApproved = existingResult?.review_status === 'approved'
    const { error } = ownerApproved ? { error: null } : await loaded.service.from('tiq_league_weekly_set_results').upsert({
      session_id: loaded.session.id,
      court_number: courtNumber,
      set_number: setNumber,
      side_a_players: set.sideA,
      side_b_players: set.sideB,
      side_a_games: official.sideAGames,
      side_b_games: official.sideBGames,
      submitted_by_name: official.submittedByName,
      submitted_at: submittedAt,
      review_status: official.reviewStatus,
    }, { onConflict: 'session_id,court_number,set_number' })
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    const positiveShare = cleanAvailabilityText(body.positiveShare, 800)
    if (positiveShare) {
      await loaded.service.from('tiq_league_weekly_responses').update({ positive_share: positiveShare }).eq('session_id', loaded.session.id).eq('player_name', canonicalPlayerName)
    }
    const message = ownerApproved
      ? `Your score is recorded. The league-approved score remains official.`
      : official.reviewStatus === 'confirmed'
        ? `Court ${courtNumber}, set ${setNumber} is confirmed by matching submissions.`
        : official.reviewStatus === 'disputed'
          ? `Your score is recorded. The league owner will review the different submissions.`
          : `Court ${courtNumber}, set ${setNumber} is saved and waiting for confirmation.`
    return Response.json({ ok: true, reviewStatus: ownerApproved ? 'approved' : official.reviewStatus, message })
  }

  return Response.json({ ok: false, message: 'Choose a weekly league action.' }, { status: 400 })
}
