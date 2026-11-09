import type {SupabaseClient} from '@supabase/supabase-js'

export const PLAYER_RECENT_MATCH_LIMIT = 10
export const PLAYER_MATCH_TYPES = ['singles', 'doubles'] as const

export type PlayerMatchParticipant = {
  player_id: string
  side: string | null
  seat: number | null
  players: {name: string | null} | {name: string | null}[] | null
}

export type PlayerMatchHistoryRow = {
  id: string
  match_date: string | null
  match_type: string | null
  league_name: string | null
  score: string | null
  winner_side: string | null
  match_players: {player_id: string; side: string | null}[]
  participants?: PlayerMatchParticipant[] | null
}

// Team scorecard totals also link to players. Select eligible individual courts
// before ordering or pagination so a team win never becomes a personal win.
// A numbered line is not required: older imported individual courts can lack one.
export function playerMatchHistoryQuery(client: SupabaseClient, playerId: string, includeParticipants = false) {
  const fields = 'id,match_date,match_type,league_name,score,winner_side,match_players!inner(player_id,side)'
  const matches = client.from('matches')
  const query = includeParticipants
    ? matches.select(`${fields},participants:match_players(player_id,side,seat,players(name))`)
    : matches.select(fields)
  return query
    .eq('match_players.player_id', playerId)
    .eq('public_history_eligible', true)
    .in('match_type', PLAYER_MATCH_TYPES)
    .order('match_date', {ascending: false, nullsFirst: false})
    .order('id', {ascending: false})
}
