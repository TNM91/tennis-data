import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeLeagueWeeklySettings, type LeagueWeeklySettings } from '@/lib/league-weekly-format'
import {
  buildLeagueWeeklyCompetitionView,
  type LeagueWeeklyRecordSession,
  type LeagueWeeklyRecordSetResult,
} from '@/lib/league-weekly-player-records'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type LeagueRow = {
  id: string
  is_public: boolean | null
  created_by_user_id: string | null
  weekly_settings: unknown
  players: unknown
}

type ProfileRow = { linked_player_id?: string | null; linked_player_name?: string | null }
type EntryRow = { player_id?: string | null; player_name?: string | null; entry_status?: string | null }

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Weekly league results are not configured.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { leagueId } = await params
  const normalizedLeagueId = leagueId.trim()
  if (!normalizedLeagueId) return Response.json({ ok: false, message: 'Choose a league.' }, { status: 400 })

  const { data: league, error: leagueError } = await service
    .from('tiq_leagues')
    .select('id,is_public,created_by_user_id,weekly_settings,players')
    .eq('id', normalizedLeagueId)
    .maybeSingle()
  if (leagueError) return Response.json({ ok: false, message: 'Weekly league results could not be loaded.' }, { status: 500 })
  if (!league) return Response.json({ ok: false, message: 'This league could not be found.' }, { status: 404 })
  const leagueRow = league as LeagueRow
  if (!normalizeLeagueWeeklySettings(leagueRow.weekly_settings as Partial<LeagueWeeklySettings> | null).enabled) {
    return Response.json({ ok: false, message: 'This league does not use weekly doubles scorecards.' }, { status: 409 })
  }

  const isPublic = leagueRow.is_public !== false
  if (!isPublic && !await canReadPrivateLeague(request, service, leagueRow)) {
    return Response.json({ ok: false, message: 'Sign in with access to this league.' }, { status: 403 })
  }

  const [{ data: sessions, error: sessionError }, { data: activeEntries, error: entryError }] = await Promise.all([
    service
      .from('tiq_league_weekly_sessions')
      .select('id,league_id,status,play_on')
      .eq('league_id', leagueRow.id)
      .in('status', ['published', 'completed'])
      .order('play_on', { ascending: false }),
    service
      .from('tiq_player_league_entries')
      .select('player_name')
      .eq('league_id', leagueRow.id)
      .eq('entry_status', 'active'),
  ])
  if (sessionError) return Response.json({ ok: false, message: 'Weekly league scorecards could not be loaded.' }, { status: 500 })
  if (entryError) return Response.json({ ok: false, message: 'Weekly league standings could not be loaded.' }, { status: 500 })
  const sessionRows = (sessions || []) as LeagueWeeklyRecordSession[]
  const activeEntryNames = ((activeEntries || []) as Array<{ player_name?: string | null }>)
    .map((entry) => cleanText(entry.player_name))
    .filter(Boolean)
  const fallbackPlayerNames = Array.isArray(leagueRow.players) ? leagueRow.players.map(cleanText).filter(Boolean) : []
  const playerNames = Array.from(new Set(activeEntryNames.length ? activeEntryNames : fallbackPlayerNames))

  let resultRows: LeagueWeeklyRecordSetResult[] = []
  if (sessionRows.length) {
    const { data: results, error: resultError } = await service
      .from('tiq_league_weekly_set_results')
      .select('session_id,court_number,set_number,side_a_players,side_b_players,side_a_games,side_b_games,review_status')
      .in('session_id', sessionRows.map((session) => session.id))
      .in('review_status', ['confirmed', 'approved'])
      .order('court_number')
      .order('set_number')
    if (resultError) return Response.json({ ok: false, message: 'Weekly league scores could not be loaded.' }, { status: 500 })
    resultRows = (results || []) as LeagueWeeklyRecordSetResult[]
  }

  return Response.json({
    ok: true,
    view: buildLeagueWeeklyCompetitionView({ leagueId: leagueRow.id, playerNames, sessions: sessionRows, results: resultRows }),
  }, {
    headers: { 'Cache-Control': isPublic ? 'public, max-age=60, stale-while-revalidate=300' : 'private, no-store' },
  })
}

async function canReadPrivateLeague(request: Request, service: SupabaseClient, league: LeagueRow) {
  const token = getBearerToken(request)
  if (!token) return false
  const auth = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user) return false
  if (league.created_by_user_id === authData.user.id) return true

  const { data: delegate } = await service
    .from('tiq_league_delegates')
    .select('league_id')
    .eq('league_id', league.id)
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (delegate) return true

  const [{ data: profile }, { data: entries }] = await Promise.all([
    service.from('profiles').select('linked_player_id,linked_player_name').eq('id', authData.user.id).maybeSingle(),
    service.from('tiq_player_league_entries').select('player_id,player_name,entry_status').eq('league_id', league.id).eq('entry_status', 'active'),
  ])
  const linkedPlayerId = cleanText((profile as ProfileRow | null)?.linked_player_id)
  const linkedPlayerName = cleanText((profile as ProfileRow | null)?.linked_player_name).toLowerCase()
  return ((entries || []) as EntryRow[]).some((entry) => {
    const entryPlayerId = cleanText(entry.player_id)
    if (linkedPlayerId && entryPlayerId) return linkedPlayerId === entryPlayerId
    return Boolean(linkedPlayerName && cleanText(entry.player_name).toLowerCase() === linkedPlayerName)
  })
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
