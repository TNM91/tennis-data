import { describe, expect, it } from 'vitest'

import {
  calculateDynamicPointsForSides,
  compareTiqTeamStandings,
  formatDynamicPointsForSides,
  getDynamicPointsValidationMessage,
  parseTennisScoreSets,
  validateTiqTennisMatchScore,
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

  it('caps straight-set loser points at 8', () => {
    expect(calculateDynamicPointsForSides('7-6, 7-6', 'A')).toMatchObject({
      sideAPoints: 14,
      sideBPoints: 8,
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

  it('rejects one-set scores because dynamic points require best-of-3 completion', () => {
    expect(calculateDynamicPointsForSides('6-4', 'A')).toMatchObject({
      sideAPoints: 0,
      sideBPoints: 0,
      valid: false,
    })
  })
})

describe('validateTiqTennisMatchScore', () => {
  it('rejects tied set scores such as 7-7', () => {
    expect(validateTiqTennisMatchScore('7-7, 6-4', 'A')).toMatchObject({
      valid: false,
      message: 'A tennis set cannot end tied. Use 7-6 for a tiebreak set, not 7-7.',
    })
  })

  it('allows straight-set tiebreak scores', () => {
    expect(validateTiqTennisMatchScore('7-6, 6-4', 'A')).toMatchObject({
      valid: true,
      message: '',
    })
  })

  it('allows a deciding 10-point match tiebreak', () => {
    expect(validateTiqTennisMatchScore('6-4, 4-6, 10-8', 'A')).toMatchObject({
      valid: true,
      message: '',
    })
  })

  it('rejects scores that do not match the selected winner', () => {
    expect(validateTiqTennisMatchScore('4-6, 4-6', 'A')).toMatchObject({
      valid: false,
      message: 'The selected winner must match the player who won two sets in the score.',
    })
  })
})

describe('formatDynamicPointsForSides', () => {
  it('formats valid side points for UI display', () => {
    expect(formatDynamicPointsForSides('7-6, 7-6', 'A')).toEqual({
      sideAPoints: 14,
      sideBPoints: 8,
      label: 'A 14 - B 8',
    })
  })

  it('returns null when points cannot be calculated', () => {
    expect(formatDynamicPointsForSides('4-6, 3-6', 'A')).toBeNull()
  })
})

describe('getDynamicPointsValidationMessage', () => {
  it('explains that dynamic points need a completed best-of-3 score', () => {
    expect(getDynamicPointsValidationMessage('6-4', 'A')).toBe(
      'Dynamic points need a best-of-3 score where the selected winner wins two sets.',
    )
  })

  it('allows valid straight-set scores', () => {
    expect(getDynamicPointsValidationMessage('7-6, 7-6', 'A')).toBe('')
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
