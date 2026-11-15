import { leagueScheduleService } from './native-league-schedule'
import { readOfficeResult, type OfficeLeague, type OfficePlayerStanding, type OfficeResult } from './native-league-office-contract'
import { buildTiqTeamStandings } from './tiq-team-standings'
import { normalizeTeamCompetitionRulesOverride } from './competition-rules'
import { reviewedRevisionDigest } from './first-party-revisions'

export async function loadApprovedLeagueScores(league: OfficeLeague) {
  const rpc = league.format === 'individual' ? 'native_individual_league_approved_results' : 'native_league_approved_results'
  const { data, error } = await leagueScheduleService().rpc(rpc, {
    p_league: league.id, p_version: league.updatedAt,
  }).retry(false)
  if (error || !Array.isArray(data) || data.length > 500) throw Error('Approved scores unavailable')
  const results = data.map(readOfficeResult)
  if (new Set(results.map(result => result.id)).size !== results.length) throw Error('Ambiguous league scores')
  return results
}

export function standingsFromIndividualScores(results: OfficeResult[]): OfficePlayerStanding[] {
  const players = new Map<string, OfficePlayerStanding>()
  for (const { a, b, winner } of results) {
    if (!a || !b || a === b || winner !== a && winner !== b) throw Error('Invalid individual league result')
    for (const name of [a, b]) {
      const record = players.get(name) ?? { name, wins: 0, losses: 0 }
      record[name === winner ? 'wins' : 'losses']++
      players.set(name, record)
    }
  }
  return [...players.values()].sort((a,b)=>b.wins-a.wins||a.losses-b.losses||a.name.localeCompare(b.name))
}

export function standingsFromLeagueScores(results: OfficeResult[], source: Record<string, unknown>) {
  return buildTiqTeamStandings(
    results.map(result => ({ id: result.id, team_a_name: result.a, team_b_name: result.b })),
    results.flatMap(result => result.courts.map(court => ({
      event_id: result.id, score: court.score, winner_side: court.winner === 'Side A' ? 'A' : court.winner === 'Side B' ? 'B' : '',
    })).filter(line => line.winner_side)),
    source.scoring_system === 'dynamic_points', normalizeTeamCompetitionRulesOverride(source.competition_rules).standingsRule,
  )
}

export function beforeApprovedLeagueScores(results: OfficeResult[], approved: OfficeResult[]) {
  const revisions = new Map(approved.map(result => [result.id, reviewedRevisionDigest(result)]))
  return results.filter(result => revisions.get(result.id) !== reviewedRevisionDigest(result))
}
