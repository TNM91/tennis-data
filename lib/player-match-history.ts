import type {SupabaseClient} from '@supabase/supabase-js'

export const PLAYER_RECENT_MATCH_LIMIT = 10
export const PLAYER_MATCH_TYPES = ['singles', 'doubles'] as const

export type PlayerMatchHistoryRow = {
  id: string
  match_date: string | null
  match_type: string | null
  league_name: string | null
  score: string | null
  winner_side: string | null
  match_players: {player_id: string; side: string | null}[]
}

// Team scorecard totals also link to players. Select eligible individual courts
// before ordering or pagination so a team win never becomes a personal win.
// A numbered line is not required: older imported individual courts can lack one.
export function playerMatchHistoryQuery(client: SupabaseClient, playerId: string) {
  return client.from('matches')
    .select('id,match_date,match_type,league_name,score,winner_side,match_players!inner(player_id,side)')
    .eq('match_players.player_id', playerId)
    .eq('public_history_eligible', true)
    .in('match_type', PLAYER_MATCH_TYPES)
    .order('match_date', {ascending: false, nullsFirst: false})
    .order('id', {ascending: false})
}
