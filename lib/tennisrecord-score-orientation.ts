import { parseScoreMetrics, type MatchSide } from './recalculateRatings'

/** A deciding 1-0 tiebreak determines the winner without adding a game to
 * game-share scoring. Its side still provides evidence of score orientation. */
export function isWinnerFirstTennisRecordScore(score: string, winnerSide: MatchSide) {
  if (winnerSide !== 'B') return false
  const metrics = parseScoreMetrics(score, winnerSide)
  if (!metrics.parsed) return true
  const sets = metrics.sets
  if (sets.length !== 3 || sets[0].isMatchTiebreak || sets[1].isMatchTiebreak || !sets[2].isMatchTiebreak || sets[2].sideA !== 1 || sets[2].sideB !== 0) return false
  return (sets[0].sideA > sets[0].sideB && sets[1].sideB > sets[1].sideA)
    || (sets[0].sideB > sets[0].sideA && sets[1].sideA > sets[1].sideB)
}
