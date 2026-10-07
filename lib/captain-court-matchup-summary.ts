import { buildOpponentCourtScorePatterns } from './captain-opponent-court-score-patterns'
import type { OpponentSeasonScout } from './captain-opponent-season-scout'
import { buildPlayerSetScoreGrid, readPlayerSetScores, type SetScoreMode } from './player-set-score-grid'

export function buildCourtMatchupSummary(scout: OpponentSeasonScout, index: number, mode: SetScoreMode) {
  if (!scout.ready) return null
  const fixtures = [...scout.fixtures].sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key)).slice(0, 4)
  const latest = fixtures[0]
  const courts = latest?.courts.filter((court) => court.slotIndex === index) || []
  const court = courts.length === 1 ? courts[0] : undefined
  const required = mode === 'singles' ? 1 : 2
  if (!court || court.slotType !== mode || court.defaulted || court.needsReview
    || court.playerIds.length !== required || court.playerIds.some((id) => !id) || new Set(court.playerIds).size !== required) return null
  const pattern = buildOpponentCourtScorePatterns(scout, index, mode)[0]
  if (!pattern) return null
  const recentIds = new Set(fixtures.flatMap((fixture) => fixture.courts.map((played) => `${fixture.key}:${played.key}`)))
  const recent = [...new Map(pattern.matches.map((match) => [match.id, match])).values()].filter((match) =>
    recentIds.has(match.id) && readPlayerSetScores(match.score, match.result)
    && pattern.matches.every((other) => other.id !== match.id || (other.score === match.score && other.result === match.result)))
  const grid = buildPlayerSetScoreGrid(pattern.matches, mode)
  const close = grid.buckets.filter((bucket) => bucket.label === '7–5' || bucket.label === '7–6')
    .reduce((counts, bucket) => ({ wins: counts.wins + bucket.wins, losses: counts.losses + bucket.losses }), { wins: 0, losses: 0 })
  return { names: court.playerNames, date: latest.date, recentWins: recent.filter((match) => match.result === 'W').length,
    recentLosses: recent.filter((match) => match.result === 'L').length, recentSample: recent.length, close, seasonMatches: grid.scoredMatches }
}
