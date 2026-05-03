'use client'

import { getClientAuthState } from '@/lib/auth'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { supabase } from '@/lib/supabase'
import {
  deleteTiqTeamMatchLineMatch,
  syncTiqTeamMatchLineToMatch,
} from '@/lib/tiq-match-sync'

export type TiqTeamMatchEventRecord = {
  id: string
  leagueId: string
  teamAName: string
  teamAId: string
  teamBName: string
  teamBId: string
  matchDate: string
  facility: string
  notes: string
  winnerTeamName: string
  winnerTeamId: string
  createdAt: string
  updatedAt: string
}

export type TiqTeamMatchLineRecord = {
  id: string
  eventId: string
  lineNumber: number
  matchType: 'singles' | 'doubles'
  sideAPlayer1Name: string
  sideAPlayer1Id: string
  sideAPlayer2Name: string
  sideAPlayer2Id: string
  sideBPlayer1Name: string
  sideBPlayer1Id: string
  sideBPlayer2Name: string
  sideBPlayer2Id: string
  winnerSide: 'A' | 'B' | null
  score: string
  createdAt: string
  updatedAt: string
}

type EventRow = Record<string, unknown>
type LineRow = Record<string, unknown>

function cleanText(v: string | null | undefined) {
  return (v || '').trim()
}

function normalizeEvent(row: EventRow): TiqTeamMatchEventRecord | null {
  const id = cleanText(row.id as string)
  const leagueId = cleanText(row.league_id as string)
  if (!id || !leagueId) return null
  return {
    id,
    leagueId,
    teamAName: cleanText(row.team_a_name as string),
    teamAId: cleanText(row.team_a_id as string),
    teamBName: cleanText(row.team_b_name as string),
    teamBId: cleanText(row.team_b_id as string),
    matchDate: cleanText(row.match_date as string),
    facility: cleanText(row.facility as string),
    notes: cleanText(row.notes as string),
    winnerTeamName: cleanText(row.winner_team_name as string),
    winnerTeamId: cleanText(row.winner_team_id as string),
    createdAt: cleanText(row.created_at as string),
    updatedAt: cleanText(row.updated_at as string),
  }
}

function normalizeLine(row: LineRow): TiqTeamMatchLineRecord | null {
  const id = cleanText(row.id as string)
  const eventId = cleanText(row.event_id as string)
  if (!id || !eventId) return null
  const ws = cleanText(row.winner_side as string)
  return {
    id,
    eventId,
    lineNumber: Number(row.line_number) || 0,
    matchType: (row.match_type as string) === 'doubles' ? 'doubles' : 'singles',
    sideAPlayer1Name: cleanText(row.side_a_player_1_name as string),
    sideAPlayer1Id: cleanText(row.side_a_player_1_id as string),
    sideAPlayer2Name: cleanText(row.side_a_player_2_name as string),
    sideAPlayer2Id: cleanText(row.side_a_player_2_id as string),
    sideBPlayer1Name: cleanText(row.side_b_player_1_name as string),
    sideBPlayer1Id: cleanText(row.side_b_player_1_id as string),
    sideBPlayer2Name: cleanText(row.side_b_player_2_name as string),
    sideBPlayer2Id: cleanText(row.side_b_player_2_id as string),
    winnerSide: ws === 'A' ? 'A' : ws === 'B' ? 'B' : null,
    score: cleanText(row.score as string),
    createdAt: cleanText(row.created_at as string),
    updatedAt: cleanText(row.updated_at as string),
  }
}

async function getUserId() {
  const auth = await getClientAuthState()
  return cleanText(auth.user?.id)
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function listTiqTeamMatchEvents(filters?: {
  leagueId?: string | null
}): Promise<{ events: TiqTeamMatchEventRecord[]; warning: string | null }> {
  try {
    let query = supabase
      .from('tiq_team_league_match_events')
      .select('id, league_id, team_a_name, team_a_id, team_b_name, team_b_id, match_date, facility, notes, winner_team_name, winner_team_id, created_at, updated_at')
      .order('match_date', { ascending: false })

    if (filters?.leagueId) query = query.eq('league_id', filters.leagueId)

    const { data, error } = await query
    if (error) throw error

    return {
      events: ((data || []) as EventRow[]).map(normalizeEvent).filter(Boolean) as TiqTeamMatchEventRecord[],
      warning: null,
    }
  } catch (err) {
    return {
      events: [],
      warning: err instanceof Error ? err.message : 'Failed to load team match events.',
    }
  }
}

export async function saveTiqTeamMatchEvent(input: {
  leagueId: string
  teamAName: string
  teamAId?: string | null
  teamBName: string
  teamBId?: string | null
  matchDate: string
  facility?: string | null
  notes?: string | null
}): Promise<{ event: TiqTeamMatchEventRecord | null; warning: string | null }> {
  try {
    const userId = await getUserId()
    if (!userId) return { event: null, warning: 'Sign in to save team match events.' }

    const { data, error } = await supabase
      .from('tiq_team_league_match_events')
      .insert({
        league_id: cleanText(input.leagueId),
        team_a_name: cleanText(input.teamAName),
        team_a_id: cleanText(input.teamAId) || null,
        team_b_name: cleanText(input.teamBName),
        team_b_id: cleanText(input.teamBId) || null,
        match_date: cleanText(input.matchDate),
        facility: cleanText(input.facility),
        notes: cleanText(input.notes),
        created_by_user_id: userId,
        updated_by_user_id: userId,
      })
      .select()
      .single()

    if (error) throw error

    const event = normalizeEvent(data as EventRow)
    return { event, warning: null }
  } catch (err) {
    return {
      event: null,
      warning: err instanceof Error ? err.message : 'Failed to save team match event.',
    }
  }
}

export async function deleteTiqTeamMatchEvent(eventId: string): Promise<{ warning: string | null }> {
  try {
    const userId = await getUserId()
    if (!userId) return { warning: 'Sign in to delete team match events.' }

    // Lines are cascade-deleted by the DB; we still need to clean up the mirrored matches.
    const { data: lines } = await supabase
      .from('tiq_team_league_match_lines')
      .select('id')
      .eq('event_id', eventId)

    const { error } = await supabase
      .from('tiq_team_league_match_events')
      .delete()
      .eq('id', eventId)

    if (error) throw error

    let syncWarning: string | null = null
    try {
      for (const line of (lines || []) as Array<{ id: string }>) {
        await deleteTiqTeamMatchLineMatch(line.id)
      }
      await recalculateDynamicRatings()
    } catch (syncErr) {
      syncWarning =
        syncErr instanceof Error
          ? `Event deleted — rating sync failed and will apply on next recalculation: ${syncErr.message}`
          : 'Event deleted — rating sync failed.'
    }

    return { warning: syncWarning }
  } catch (err) {
    return { warning: err instanceof Error ? err.message : 'Failed to delete team match event.' }
  }
}

// ─── Lines ────────────────────────────────────────────────────────────────────

export async function listTiqTeamMatchLines(eventId: string): Promise<{
  lines: TiqTeamMatchLineRecord[]
  warning: string | null
}> {
  try {
    const { data, error } = await supabase
      .from('tiq_team_league_match_lines')
      .select('id, event_id, line_number, match_type, side_a_player_1_name, side_a_player_1_id, side_a_player_2_name, side_a_player_2_id, side_b_player_1_name, side_b_player_1_id, side_b_player_2_name, side_b_player_2_id, winner_side, score, created_at, updated_at')
      .eq('event_id', eventId)
      .order('line_number', { ascending: true })

    if (error) throw error

    return {
      lines: ((data || []) as LineRow[]).map(normalizeLine).filter(Boolean) as TiqTeamMatchLineRecord[],
      warning: null,
    }
  } catch (err) {
    return {
      lines: [],
      warning: err instanceof Error ? err.message : 'Failed to load team match lines.',
    }
  }
}

export async function saveTiqTeamMatchLine(
  event: TiqTeamMatchEventRecord,
  input: {
    lineNumber: number
    matchType: 'singles' | 'doubles'
    sideAPlayer1Name: string
    sideAPlayer1Id?: string | null
    sideAPlayer2Name?: string | null
    sideAPlayer2Id?: string | null
    sideBPlayer1Name: string
    sideBPlayer1Id?: string | null
    sideBPlayer2Name?: string | null
    sideBPlayer2Id?: string | null
    winnerSide?: 'A' | 'B' | null
    score?: string | null
  },
): Promise<{ line: TiqTeamMatchLineRecord | null; warning: string | null }> {
  try {
    const userId = await getUserId()
    if (!userId) return { line: null, warning: 'Sign in to save match lines.' }

    const { data, error } = await supabase
      .from('tiq_team_league_match_lines')
      .upsert(
        {
          event_id: event.id,
          line_number: input.lineNumber,
          match_type: input.matchType,
          side_a_player_1_name: cleanText(input.sideAPlayer1Name),
          side_a_player_1_id: cleanText(input.sideAPlayer1Id) || null,
          side_a_player_2_name: cleanText(input.sideAPlayer2Name),
          side_a_player_2_id: cleanText(input.sideAPlayer2Id) || null,
          side_b_player_1_name: cleanText(input.sideBPlayer1Name),
          side_b_player_1_id: cleanText(input.sideBPlayer1Id) || null,
          side_b_player_2_name: cleanText(input.sideBPlayer2Name),
          side_b_player_2_id: cleanText(input.sideBPlayer2Id) || null,
          winner_side: input.winnerSide ?? null,
          score: cleanText(input.score),
          created_by_user_id: userId,
          updated_by_user_id: userId,
        },
        { onConflict: 'event_id,line_number' },
      )
      .select()
      .single()

    if (error) throw error

    const line = normalizeLine(data as LineRow)
    if (!line) return { line: null, warning: 'Line saved but could not be read back.' }

    // Only sync completed lines into the rating engine.
    let syncWarning: string | null = null
    if (line.winnerSide) {
      try {
        await syncTiqTeamMatchLineToMatch(line, event)
        await recalculateDynamicRatings()
      } catch (syncErr) {
        syncWarning =
          syncErr instanceof Error
            ? `Line saved — rating sync failed and will apply on next recalculation: ${syncErr.message}`
            : 'Line saved — rating sync failed.'
      }
    }

    return { line, warning: syncWarning }
  } catch (err) {
    return { line: null, warning: err instanceof Error ? err.message : 'Failed to save match line.' }
  }
}

// ─── Standings ────────────────────────────────────────────────────────────────

export type TiqTeamStandingRow = {
  teamName: string
  wins: number
  losses: number
  ties: number
  lineWins: number
  lineLosses: number
}

export async function computeTiqTeamLeagueStandings(leagueId: string): Promise<{
  standings: TiqTeamStandingRow[]
  warning: string | null
}> {
  try {
    const { data: events, error: eventsError } = await supabase
      .from('tiq_team_league_match_events')
      .select('id, team_a_name, team_b_name')
      .eq('league_id', leagueId)

    if (eventsError) throw eventsError
    if (!events?.length) return { standings: [], warning: null }

    const eventIds = events.map((e) => (e as Record<string, unknown>).id as string)

    const { data: lines, error: linesError } = await supabase
      .from('tiq_team_league_match_lines')
      .select('event_id, winner_side')
      .in('event_id', eventIds)
      .not('winner_side', 'is', null)

    if (linesError) throw linesError

    const lineCountsByEvent: Record<string, { a: number; b: number }> = {}
    for (const line of (lines || []) as Array<{ event_id: string; winner_side: string }>) {
      if (!lineCountsByEvent[line.event_id]) lineCountsByEvent[line.event_id] = { a: 0, b: 0 }
      if (line.winner_side === 'A') lineCountsByEvent[line.event_id].a++
      else if (line.winner_side === 'B') lineCountsByEvent[line.event_id].b++
    }

    const records: Record<string, TiqTeamStandingRow> = {}

    function ensureTeam(name: string) {
      if (!records[name]) records[name] = { teamName: name, wins: 0, losses: 0, ties: 0, lineWins: 0, lineLosses: 0 }
    }

    for (const event of events as Array<{ id: string; team_a_name: string; team_b_name: string }>) {
      const counts = lineCountsByEvent[event.id] || { a: 0, b: 0 }
      ensureTeam(event.team_a_name)
      ensureTeam(event.team_b_name)

      if (counts.a > counts.b) {
        records[event.team_a_name].wins++
        records[event.team_b_name].losses++
      } else if (counts.b > counts.a) {
        records[event.team_b_name].wins++
        records[event.team_a_name].losses++
      } else if (counts.a > 0 || counts.b > 0) {
        records[event.team_a_name].ties++
        records[event.team_b_name].ties++
      }

      records[event.team_a_name].lineWins += counts.a
      records[event.team_a_name].lineLosses += counts.b
      records[event.team_b_name].lineWins += counts.b
      records[event.team_b_name].lineLosses += counts.a
    }

    const standings = Object.values(records).sort(
      (a, b) => b.wins - a.wins || b.lineWins - a.lineWins,
    )

    return { standings, warning: null }
  } catch (err) {
    return {
      standings: [],
      warning: err instanceof Error ? err.message : 'Failed to compute standings.',
    }
  }
}

export async function deleteTiqTeamMatchLine(lineId: string): Promise<{ warning: string | null }> {
  try {
    const userId = await getUserId()
    if (!userId) return { warning: 'Sign in to delete match lines.' }

    const { error } = await supabase
      .from('tiq_team_league_match_lines')
      .delete()
      .eq('id', lineId)

    if (error) throw error

    let syncWarning: string | null = null
    try {
      await deleteTiqTeamMatchLineMatch(lineId)
      await recalculateDynamicRatings()
    } catch (syncErr) {
      syncWarning =
        syncErr instanceof Error
          ? `Line deleted — rating sync failed: ${syncErr.message}`
          : 'Line deleted — rating sync failed.'
    }

    return { warning: syncWarning }
  } catch (err) {
    return { warning: err instanceof Error ? err.message : 'Failed to delete match line.' }
  }
}
