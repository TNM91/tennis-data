import { formatDynamicPointsForSides } from './tiq-scoring'

export type MatchLineSummary = {
  total: number; completed: number; teamAWins: number; teamBWins: number
  teamAPoints: number; teamBPoints: number; scoreReview: number
}

export function summarizeTeamMatchLines(eventIds: string[], rows: Array<{ event_id: string; winner_side: string | null; score: string | null }>) {
  const summaries = new Map<string, MatchLineSummary>()
  for (const id of eventIds) summaries.set(id, { total: 0, completed: 0, teamAWins: 0, teamBWins: 0, teamAPoints: 0, teamBPoints: 0, scoreReview: 0 })
  for (const row of rows) {
    const summary = summaries.get(row.event_id)
    if (!summary) continue
    summary.total++
    const winner = row.winner_side === 'A' || row.winner_side === 'B' ? row.winner_side : null
    if (winner) { summary.completed++; if (winner === 'A') summary.teamAWins++; else summary.teamBWins++ }
    const points = formatDynamicPointsForSides(row.score, winner)
    if (points) { summary.teamAPoints += points.sideAPoints; summary.teamBPoints += points.sideBPoints }
    else if (winner && row.score) summary.scoreReview++
  }
  return summaries
}
