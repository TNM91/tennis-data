import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanAvailabilityText } from '@/lib/captain-availability-request-server'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import type { LeagueWeeklyCourt } from '@/lib/league-weekly-format'

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
  const sideAGames = Number(body?.sideAGames)
  const sideBGames = Number(body?.sideBGames)
  const assignments = Array.isArray(row.assignments) ? row.assignments as LeagueWeeklyCourt[] : []
  const set = assignments.find((court) => court.courtNumber === courtNumber)?.sets.find((item) => item.setNumber === setNumber)
  if (!set) return Response.json({ ok: false, message: 'Choose a set from this week’s court plan.' }, { status: 400 })
  if (![sideAGames, sideBGames].every((score) => Number.isInteger(score) && score >= 0 && score <= 99) || sideAGames === sideBGames) {
    return Response.json({ ok: false, message: 'Enter a completed set score with one winning side.' }, { status: 400 })
  }
  const { error } = await service.from('tiq_league_weekly_set_results').upsert({
    session_id: row.id,
    court_number: courtNumber,
    set_number: setNumber,
    side_a_players: set.sideA,
    side_b_players: set.sideB,
    side_a_games: sideAGames,
    side_b_games: sideBGames,
    submitted_by_name: 'League review',
    submitted_at: new Date().toISOString(),
    review_status: 'approved',
    approved_by_user_id: authData.user.id,
    approved_at: new Date().toISOString(),
    review_note: cleanAvailabilityText(body?.reviewNote, 500),
  }, { onConflict: 'session_id,court_number,set_number' })
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  return Response.json({ ok: true, message: `Court ${courtNumber}, set ${setNumber} is approved.` })
}

async function canManageLeague(service: SupabaseClient, session: SessionRow, userId: string) {
  if (session.league?.created_by_user_id === userId) return true
  const { data } = await service.from('tiq_league_delegates').select('id').eq('league_id', session.league_id).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}
