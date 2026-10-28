import {matchupOutcome} from '../../lib/matchup-outcome'
import type { SupabaseClient } from '@supabase/supabase-js'

export type {PlayerMatchHistoryRow as RecentMatchRow} from '../../lib/player-match-history'
import {PLAYER_RECENT_MATCH_LIMIT, playerMatchHistoryQuery, type PlayerMatchHistoryRow as RecentMatchRow} from '../../lib/player-match-history'

export function matchResult(row: RecentMatchRow, playerId: string): 'Won' | 'Lost' | 'Result pending' {
  const participant = row.match_players.find(player => player.player_id === playerId)
  const side = participant?.side
  const outcome=matchupOutcome(side,row.winner_side)
  return outcome==='A'?'Won':outcome==='B'?'Lost':'Result pending'
}

export function matchDate(value: string | null): string {
  // Treat match dates as calendar dates, independent of the phone's time zone.
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return 'Date unavailable'
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return 'Date unavailable'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export async function loadRecentResults(client: SupabaseClient, playerId: string) {
  return playerMatchHistoryQuery(client, playerId)
    .limit(PLAYER_RECENT_MATCH_LIMIT)
    .abortSignal(AbortSignal.timeout(12000))
}
