import type { SupabaseClient } from '@supabase/supabase-js'

export type RecentMatchRow = {
  id: string
  match_date: string | null
  match_type: string | null
  league_name: string | null
  score: string | null
  winner_side: string | null
  match_players: { player_id: string; side: string | null }[]
}

export function matchResult(row: RecentMatchRow, playerId: string): 'Won' | 'Lost' | 'Result pending' {
  const participant = row.match_players.find(player => player.player_id === playerId)
  const side = participant?.side
  if (!['A', 'B'].includes(side || '') || !['A', 'B'].includes(row.winner_side || '')) return 'Result pending'
  return side === row.winner_side ? 'Won' : 'Lost'
}

export function matchDate(value: string | null): string {
  // Treat match dates as calendar dates, independent of the phone's time zone.
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return 'Date unavailable'
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return 'Date unavailable'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export async function loadRecentResults(client: SupabaseClient, playerId: string) {
  // Inner join filters the parent matches before ordering/limiting, so older
  // participation rows cannot hide the player's newest results.
  return client.from('matches')
    .select('id,match_date,match_type,league_name,score,winner_side,match_players!inner(player_id,side)')
    .eq('match_players.player_id', playerId)
    .order('match_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(10)
    .abortSignal(AbortSignal.timeout(12000))
}
