import { createClient } from '@supabase/supabase-js'
import {
  buildLeagueWeeklyPlayerRecords,
  type LeagueWeeklyRecordSession,
  type LeagueWeeklyRecordSetResult,
} from '@/lib/league-weekly-player-records'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { normalizeLeagueWeeklySettings, type LeagueWeeklySettings } from '@/lib/league-weekly-format'

export const runtime = 'nodejs'

type ProfileRow = { linked_player_id?: string | null; linked_player_name?: string | null }
type EntryRow = { league_id?: string | null; player_id?: string | null; player_name?: string | null; entry_status?: string | null }

export async function GET(request: Request) {
  const token = getBearerToken(request)
  if (!token) return Response.json({ ok: false, message: 'Sign in to view your league records.' }, { status: 401 })

  const auth = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user) return Response.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Player league records are not configured.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('linked_player_id,linked_player_name')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (profileError) return Response.json({ ok: false, message: 'Your linked player could not be loaded.' }, { status: 500 })

  const linkedPlayerId = cleanText((profile as ProfileRow | null)?.linked_player_id)
  const linkedPlayerName = cleanText((profile as ProfileRow | null)?.linked_player_name)
  if (!linkedPlayerId && !linkedPlayerName) return privateJson({ ok: true, records: [] })

  const entryQueries = []
  if (linkedPlayerId) {
    entryQueries.push(service.from('tiq_player_league_entries').select('league_id,player_id,player_name,entry_status').eq('player_id', linkedPlayerId).eq('entry_status', 'active'))
  }
  if (linkedPlayerName) {
    entryQueries.push(service.from('tiq_player_league_entries').select('league_id,player_id,player_name,entry_status').eq('player_name', linkedPlayerName).eq('entry_status', 'active'))
  }
  const entryResults = await Promise.all(entryQueries)
  const entryError = entryResults.find((result) => result.error)?.error
  if (entryError) return Response.json({ ok: false, message: 'Your league entries could not be loaded.' }, { status: 500 })

  const entriesByLeague = new Map<string, EntryRow>()
  for (const row of entryResults.flatMap((result) => (result.data || []) as EntryRow[])) {
    const leagueId = cleanText(row.league_id)
    const entryPlayerId = cleanText(row.player_id)
    const entryPlayerName = cleanText(row.player_name)
    const idMatches = Boolean(linkedPlayerId && entryPlayerId && linkedPlayerId === entryPlayerId)
    const nameFallbackMatches = Boolean(linkedPlayerName && !entryPlayerId && linkedPlayerName.toLowerCase() === entryPlayerName.toLowerCase())
    if (leagueId && (idMatches || nameFallbackMatches)) entriesByLeague.set(leagueId, row)
  }
  const participants = [...entriesByLeague.entries()].map(([leagueId, entry]) => ({ leagueId, playerName: cleanText(entry.player_name) }))
  if (!participants.length) return privateJson({ ok: true, records: [] })

  const [{ data: leagues, error: leagueError }, { data: sessions, error: sessionError }] = await Promise.all([
    service.from('tiq_leagues').select('id,weekly_settings').in('id', participants.map(participant => participant.leagueId)),
    service.from('tiq_league_weekly_sessions').select('id,league_id,status,play_on')
      .in('league_id', participants.map(participant => participant.leagueId))
      .in('status', ['published', 'completed']),
  ])
  if (leagueError) return Response.json({ ok: false, message: 'League settings could not be loaded.' }, { status: 500 })
  const rankingsByLeague = new Map((leagues || []).map(league => [
    league.id as string, normalizeLeagueWeeklySettings(league.weekly_settings as Partial<LeagueWeeklySettings> | null).showRankings,
  ]))

  if (sessionError) return Response.json({ ok: false, message: 'Weekly league sessions could not be loaded.' }, { status: 500 })
  const sessionRows = (sessions || []) as LeagueWeeklyRecordSession[]
  if (!sessionRows.length) return privateJson({ ok: true, records: [] })

  const { data: results, error: resultError } = await service
    .from('tiq_league_weekly_set_results')
    .select('session_id,court_number,set_number,side_a_players,side_b_players,side_a_games,side_b_games,review_status')
    .in('session_id', sessionRows.map((session) => session.id))
    .in('review_status', ['confirmed', 'approved'])
  if (resultError) return Response.json({ ok: false, message: 'Weekly league scores could not be loaded.' }, { status: 500 })

  return privateJson({
    ok: true,
    records: buildLeagueWeeklyPlayerRecords({
      participants: participants.map(participant => ({ ...participant, showRankings: rankingsByLeague.get(participant.leagueId) !== false })),
      sessions: sessionRows,
      results: (results || []) as LeagueWeeklyRecordSetResult[],
    }),
  })
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function privateJson(body: unknown) {
  return Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
}
