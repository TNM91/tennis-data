import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTeamCourtPlayers, loadTeamCourtResults, type TeamCourtMatch } from './team-court-results'
import { validateTiqTennisMatchScore } from './tiq-scoring'

export type LeagueCourtPlayer = {
  match_id: string; side: string; player_id: string
  players: { id: string; name: string } | { id: string; name: string }[] | null
}
export type LeagueCourtData = { courts: TeamCourtMatch[]; players: LeagueCourtPlayer[] }

/** Resolve exact league parents on the displayed dates before paging their courts. */
export async function loadLeagueCourtData(client: SupabaseClient, scope: {
  league: string; flight?: string; section?: string; district?: string
}, dates: string[]): Promise<{ data: LeagueCourtData | null; error: { message: string } | null }> {
  const parents: { externalId: string; matchDate: string | null }[] = []
  const uniqueDates = [...new Set(dates.filter(Boolean))]
  if (!uniqueDates.length) return { data: { courts: [], players: [] }, error: null }
  // Bound date filters as the complete history grows across a long season.
  for (let start = 0; start < uniqueDates.length; start += 50) {
    const dateBatch = uniqueDates.slice(start, start + 50)
    for (let offset = 0; ; offset += 200) {
      let query = client.from('matches').select('id,external_match_id,match_date')
        .eq('league_name', scope.league).is('line_number', null)
        .not('external_match_id', 'is', null).in('match_date', dateBatch)
      if (scope.flight) query = query.eq('flight', scope.flight)
      if (scope.section) query = query.eq('usta_section', scope.section)
      if (scope.district) query = query.eq('district_area', scope.district)
      const result = await query.order('id').range(offset, offset + 199)
      if (result.error) return { data: null, error: result.error }
      const rows = result.data || []
      parents.push(...rows.map(row => ({ externalId: row.external_match_id as string, matchDate: row.match_date as string | null })))
      if (rows.length < 200) break
    }
  }
  const courts = await loadTeamCourtResults(client, parents)
  if (courts.error || !courts.data) return { data: null, error: courts.error }
  const players = await loadTeamCourtPlayers<LeagueCourtPlayer>(client, courts.data.map(row => row.id), 'match_id,side,player_id,players(id,name)')
  if (players.error || !players.data) return { data: null, error: players.error }
  return { data: { courts: courts.data, players: players.data }, error: null }
}

export function leagueCourtLeaders({ courts, players }: LeagueCourtData) {
  const winners = new Map(courts.filter(row => row.winner_side === 'A' || row.winner_side === 'B').map(row => [row.id, row.winner_side]))
  const appearances = new Map<string, { id: string; name: string; side: string; match: string; conflict: boolean }>()
  for (const row of players) {
    const player = Array.isArray(row.players) ? row.players[0] : row.players
    if (!winners.has(row.match_id) || !player?.name || player.id !== row.player_id || !['A', 'B'].includes(row.side)) continue
    const key = `${row.match_id}:${player.id}`
    const previous = appearances.get(key)
    appearances.set(key, { id: player.id, name: player.name, side: row.side, match: row.match_id, conflict: Boolean(previous?.conflict || (previous && previous.side !== row.side)) })
  }
  const leaders = new Map<string, { id: string; name: string; wins: number; losses: number; appearances: number }>()
  for (const row of appearances.values()) {
    if (row.conflict) continue
    const player = leaders.get(row.id) || { id: row.id, name: row.name, wins: 0, losses: 0, appearances: 0 }
    player.appearances++
    if (winners.get(row.match) === row.side) player.wins++
    else player.losses++
    leaders.set(row.id, player)
  }
  return [...leaders.values()].filter(player => player.appearances >= 2)
    .sort((a, b) => b.wins - a.wins || b.appearances - a.appearances || a.id.localeCompare(b.id)).slice(0, 8)
}

export function leagueCourtScorePatterns(courts: TeamCourtMatch[]) {
  const result = { dominant: 0, tiebreak: 0, threeSets: 0, missingScore: 0, total: 0 }
  for (const court of courts) {
    if (court.winner_side !== 'A' && court.winner_side !== 'B') continue
    result.total++
    const score = court.score?.replace(/[;|]/g, ',').replace(/[–−]/g, '-').replace(/\s*-\s*/g, '-')
    const validation = validateTiqTennisMatchScore(score)
    if (!validation.valid) { result.missingScore++; continue }
    const sets = validation.parsedSets.filter(set => set.kind !== 'match_tiebreak')
    if (sets.some(set => Math.max(set.sideAGames, set.sideBGames) === 6 && Math.min(set.sideAGames, set.sideBGames) === 0)) result.dominant++
    if (sets.some(set => Math.max(set.sideAGames, set.sideBGames) === 7 && Math.min(set.sideAGames, set.sideBGames) === 6)) result.tiebreak++
    if (validation.parsedSets.length === 3) result.threeSets++
  }
  return result
}
