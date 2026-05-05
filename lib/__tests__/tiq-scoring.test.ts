import { describe, expect, it } from 'vitest'

import {
  calculateDynamicPointsForSides,
  compareTiqTeamStandings,
  parseTennisScoreSets,
} from '../tiq-scoring'

describe('parseTennisScoreSets', () => {
  it('parses comma-separated tennis sets', () => {
    expect(parseTennisScoreSets('6-4, 6-3')).toEqual([
      { sideAGames: 6, sideBGames: 4 },
      { sideAGames: 6, sideBGames: 3 },
    ])
  })

  it('parses en dash set separators from pasted scores', () => {
    expect(parseTennisScoreSets('7\u20136 6\u20132')).toEqual([
      { sideAGames: 7, sideBGames: 6 },
      { sideAGames: 6, sideBGames: 2 },
    ])
  })

  it('ignores invalid and tied set fragments', () => {
    expect(parseTennisScoreSets('retired 4-4, 6-2')).toEqual([{ sideAGames: 6, sideBGames: 2 }])
  })
})

describe('calculateDynamicPointsForSides', () => {
  it('awards 14 points to a straight-set winner and game points to the loser', () => {
    expect(calculateDynamicPointsForSides('6-4, 6-3', 'A')).toMatchObject({
      sideAPoints: 14,
      sideBPoints: 7,
      valid: true,
    })
  })

  it('awards 12-8 for a split-set match', () => {
    expect(calculateDynamicPointsForSides('6-4, 4-6, 10-7', 'A')).toMatchObject({
      sideAPoints: 12,
      sideBPoints: 8,
      valid: true,
    })
  })

  it('rejects scores where the declared winner did not win more sets', () => {
    expect(calculateDynamicPointsForSides('4-6, 3-6', 'A')).toMatchObject({
      sideAPoints: 0,
      sideBPoints: 0,
      valid: false,
    })
  })
})

describe('compareTiqTeamStandings', () => {
  const oneWinTeam = { teamName: 'One Win', wins: 1, lineWins: 2, points: 2 }
  const noWinTeam = { teamName: 'No Win', wins: 0, lineWins: 4, points: 4 }

  it('keeps match wins ahead of line points for standard leagues', () => {
    expect([noWinTeam, oneWinTeam].sort((a, b) => compareTiqTeamStandings(a, b, 'standard'))).toEqual([
      oneWinTeam,
      noWinTeam,
    ])
  })

  it('sorts by points first for dynamic-points leagues', () => {
    expect([oneWinTeam, noWinTeam].sort((a, b) => compareTiqTeamStandings(a, b, 'dynamic_points'))).toEqual([
      noWinTeam,
      oneWinTeam,
    ])
  })
})
