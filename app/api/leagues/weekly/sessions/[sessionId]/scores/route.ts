import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanAvailabilityText } from '@/lib/captain-availability-request-server'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { validateLeagueWeeklySetScore, type LeagueWeeklyCourt } from '@/lib/league-weekly-format'

export const runtime = 'nodejs'

type SessionRow = {
  id: string
  league_id: string
  assignments: unknown
  league: { created_by_user_id: string | null } | null
}

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  if (!token) return Response.json({ ok: false, message: 'Sign in to review league scores.' }, { status: 401 })
  const auth = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user) return Response.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 })
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Score review is not configured.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { sessionId } = await params
  const { data: session, error: sessionError } = await service.from('tiq_league_weekly_sessions')
    .select('id,league_id,assignments,league:tiq_leagues!inner(created_by_user_id)')
    .eq('id', sessionId)
    .maybeSingle()
  if (sessionError) return Response.json({ ok: false, message: sessionError.message }, { status: 500 })
  if (!session) return Response.json({ ok: false, message: 'This weekly session was not found.' }, { status: 404 })
  const row = session as unknown as SessionRow
  if (!await canManageLeague(service, row, authData.user.id)) return Response.json({ ok: false, message: 'Only the league owner or a delegate can review these scores.' }, { status: 403 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const courtNumber = Number(body?.courtNumber)
  const setNumber = Number(body?.setNumber)
  const sideAGames = typeof body?.sideAGames === 'number' ? body.sideAGames : Number.NaN
  const sideBGames = typeof body?.sideBGames === 'number' ? body.sideBGames : Number.NaN
  const assignments = Array.isArray(row.assignments) ? row.assignments as LeagueWeeklyCourt[] : []
  const set = assignments.find((court) => court.courtNumber === courtNumber)?.sets.find((item) => item.setNumber === setNumber)
  if (!set) return Response.json({ ok: false, message: 'Choose a set from this week’s court plan.' }, { status: 400 })
  const scoreValidation = validateLeagueWeeklySetScore(sideAGames, sideBGames)
  if (!scoreValidation.valid) return Response.json({ ok: false, message: scoreValidation.message }, { status: 400 })
  const reviewNote = cleanAvailabilityText(body?.reviewNote, 500)
  const { data: previous, error: previousError } = await service.from('tiq_league_weekly_set_results').select('review_status,side_a_games,side_b_games').eq('session_id', row.id).eq('court_number', courtNumber).eq('set_number', setNumber).maybeSingle()
  if (previousError) return Response.json({ ok: false, message: 'The current score could not be checked.' }, { status: 503 })
  if (previous && ['approved', 'confirmed'].includes(previous.review_status) && (previous.side_a_games !== sideAGames || previous.side_b_games !== sideBGames) && !reviewNote) return Response.json({ ok: false, message: 'Add a reason before correcting an official score.' }, { status: 400 })
  const manager = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await manager.rpc('approve_tiq_weekly_score', { target_session_id: row.id, target_court: courtNumber, target_set: setNumber, games_a: sideAGames, games_b: sideBGames, correction_note: reviewNote, expected_score: body?.expectedScore ?? null })
  if (error) return Response.json({ ok: false, message: error.message }, { status: error.message.includes('changed') ? 409 : 400 })
  return Response.json({ ok: true, message: `Court ${courtNumber}, set ${setNumber} is approved.` })
}

async function canManageLeague(service: SupabaseClient, session: SessionRow, userId: string) {
  if (session.league?.created_by_user_id === userId) return true
  const { data } = await service.from('tiq_league_delegates').select('user_id').eq('league_id', session.league_id).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  if (!token) return Response.json({ message: 'Sign in to view score history.' }, { status: 401 })
  const client = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await client.auth.getUser(token)
  if (authError || !authData.user) return Response.json({ message: 'Sign in again to view score history.' }, { status: 401 })
  const { sessionId } = await params
  const { data: session } = await client.from('tiq_league_weekly_sessions').select('id').eq('id', sessionId).maybeSingle()
  if (!session) return Response.json({ message: 'Only League Office can view this score history.' }, { status: 403 })
  const { data, error } = await client.from('tiq_league_weekly_score_history').select('court_number,set_number,previous_score,next_score,changed_at').eq('session_id', sessionId).order('changed_at', { ascending: false }).limit(200)
  if (error) return Response.json({ message: 'Score history is not available yet.' }, { status: 503 })
  return Response.json({ history: data }, { headers: { 'Cache-Control': 'no-store' } })
}
