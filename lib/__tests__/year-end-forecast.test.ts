import { describe, expect, it } from 'vitest'
import { annualLabelIndex, evaluateMovement, ratingMovementProbabilities, replayYearEndForecast, type AnnualLabel, type ForecastMatch } from '../year-end-forecast'

const label = (playerId: string, season: number, level: number): AnnualLabel => ({ playerId, season, level, designation: 'computer', sourceUrl: 'https://www.tennisrecord.com/adult/profile.aspx?playername=' + playerId, capturedAt: '2026-01-01' })
const match: ForecastMatch = { id: 'm', match_date: '2025-04-01', match_type: 'singles', score: '0-6 0-6', winner_side: 'B', match_source: 'usta', sectionEligible: true, participants: [{ playerId: 'a', side: 'A' }, { playerId: 'b', side: 'B' }] }

describe('year-end forecast evidence', () => {
  it('quarantines conflicting levels without choosing whichever was fetched last', () => {
    const index = annualLabelIndex([label('a', 2024, 4), label('a', 2024, 4.5), label('b', 2024, 4)])
    expect(index.valid.has('a:2024')).toBe(false)
    expect(index.conflicts[0].levels).toEqual([4, 4.5])
  })

  it('allows downward evidence and ignores ending labels, future matches, and duplicates', () => {
    const input = { season: 2025, startsOn: '2025-01-01', cutoff: '2025-10-01', labels: [label('a', 2024, 4), label('b', 2024, 4)], matches: [match], variant: 'band-center' as const, minimumMatches: 1 }
    const result = replayYearEndForecast(input)
    expect(result.forecasts[0].rating).toBeLessThan(3.75)
    const extended = replayYearEndForecast({ ...input, labels: [...input.labels, label('a', 2025, 5)], matches: [match, match, { ...match, id: 'future', match_date: '2025-12-01' }] })
    expect(extended.forecasts).toEqual(result.forecasts)
    expect(extended.skipped.outside_cutoff).toBe(1)
  })

  it('does not fabricate unknown opponent priors or include unconfirmed eligibility', () => {
    const result = replayYearEndForecast({ season: 2025, startsOn: '2025-01-01', cutoff: '2025-10-01', labels: [label('a', 2024, 4)], matches: [match, { ...match, id: 'mixed', sectionEligible: false }], variant: 'band-center' })
    expect(result.forecasts).toEqual([])
    expect(result.skipped).toEqual({ missing_prior_or_participants: 1, eligibility_unconfirmed: 1 })
  })

  it('compares scores on the USTA band scale and reports class-specific errors', () => {
    const middle = ratingMovementProbabilities(3.75, 4)
    expect(middle.stay).toBeGreaterThan(middle.up)
    expect(middle.down + middle.stay + middle.up).toBeCloseTo(1)
    expect(ratingMovementProbabilities(4.2, 4).up).toBeGreaterThan(0.5)
    expect(ratingMovementProbabilities(3.3, 4).down).toBeGreaterThan(0.5)
    const metrics = evaluateMovement([{ actual: 'up', probabilities: { down: 0, stay: 1, up: 0 } }])
    expect(metrics.accuracy).toBe(0)
    expect(metrics.byClass.up.recall).toBe(0)
    expect(metrics.brier).toBe(2)
    expect(evaluateMovement([]).accuracy).toBeNull()
  })
})
