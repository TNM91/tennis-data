import { expect, it } from 'vitest'
import { isWinnerFirstTennisRecordScore } from '../tennisrecord-score-orientation'
import { parseScoreMetrics } from '../recalculateRatings'

it.each(['7-5 4-6 1-0', '4-6 6-2 1-0', '6-3;3-6;1-0'])('recognizes the deciding tiebreak on the wrong winner side: %s', score => {
  expect(parseScoreMetrics(score, 'B').parsed).toBe(true)
  expect(isWinnerFirstTennisRecordScore(score, 'B')).toBe(true)
  expect(isWinnerFirstTennisRecordScore(score, 'A')).toBe(false)
})
it.each(['5-7 6-4 0-1', '7-5 2-6 0-1', '6-3 3-6', '6-3 3-6 1-0 0-1'])('does not infer a new orientation for valid or incomplete evidence: %s', score => {
  expect(isWinnerFirstTennisRecordScore(score, 'B')).toBe(false)
})
it('preserves the old straight-set rule and excludes tiebreaks from game share', () => {
  expect(isWinnerFirstTennisRecordScore('6-3 6-3', 'B')).toBe(true)
  const metrics = parseScoreMetrics('5-7 6-4 0-1', 'B')
  expect(metrics.totalGames).toBe(22)
  expect(metrics.totalGamesA).toBe(11)
  expect(metrics.totalGamesB).toBe(11)
})
