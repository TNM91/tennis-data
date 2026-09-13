import { describe, expect, it } from 'vitest'
import { applyKnownCourtDefaults, calculateTeamMatchWinProbability } from '@/lib/captain-lineup-defaults'

describe('captain USTA default projections', () => {
  it('calculates the probability of winning a majority of courts', () => {
    expect(calculateTeamMatchWinProbability([0.5, 0.5, 0.5])).toBe(0.5)
    expect(calculateTeamMatchWinProbability([1, 1, 0.1])).toBe(1)
  })

  it('locks known defaults into the court and match forecast', () => {
    const adjusted = applyKnownCourtDefaults([
      { label: 'Doubles 1', projection: 0.45 },
      { label: 'Doubles 2', projection: 0.3 },
      { label: 'Doubles 3', projection: 0.2 },
    ], [
      { label: 'Doubles 2', awardedTo: 'team' },
      { label: 'Doubles 3', awardedTo: 'team' },
    ])
    expect(adjusted.courts.map((court) => court.projection)).toEqual([0.45, 1, 1])
    expect(adjusted.matchWinProbability).toBe(1)
  })
})
