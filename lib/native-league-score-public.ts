import { leagueScheduleService } from './native-league-schedule'
import { readOfficeResult, type OfficeLeague, type OfficeResult } from './native-league-office-contract'
import { buildTiqTeamStandings } from './tiq-team-standings'
import { normalizeTeamCompetitionRulesOverride } from './competition-rules'
import { reviewedRevisionDigest } from './first-party-revisions'

export async function loadApprovedLeagueScores(league: OfficeLeague) {
  const { data, error } = await leagueScheduleService().rpc('native_league_approved_results', {
    p_league: league.id, p_version: league.updatedAt,
  }).retry(false)
  if (error || !Array.isArray(data) || data.length > 500) throw Error('Approved scores unavailable')
  const results = data.map(readOfficeResult)
  if (new Set(results.map(result => result.id)).size !== results.length) throw Error('Ambiguous league scores')
  return results
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
