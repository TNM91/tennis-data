import { describe, expect, it } from 'vitest'
import {
  extractCompetitionLevel,
  getCompetitionPairRatingIssues,
  getTournamentOperationsSummary,
  isCompetitionPairRatingEligible,
  isCompetitionPlayerRatingEligible,
  resolveTeamCompetitionRules,
} from '../competition-rules'

describe('competition rules', () => {
  it('prefers the flight level and ignores age-group numbers', () => {
    expect(extractCompetitionLevel('Adult 18 & Over', 'Women 4.0')).toBe(4)
    expect(extractCompetitionLevel('Mixed 40 & Over', '8.0')).toBe(8)
    expect(extractCompetitionLevel('Adult 55 & Over', 'Open')).toBeNull()
  })

  it.each([
    ['Adult 18 & Over', 'Women 3.5', 'straight_level', false],
    ['Adult 55 & Over', 'Women 7.0', 'combined_level', false],
    ['Mixed 18 & Over', '8.0', 'combined_level', true],
    ['Mixed 40 & Over', 'Women 4.0', 'straight_level', true],
    ['Combo Doubles', 'Women 7.5', 'combined_level', false],
    ['Tri-Level', 'Women 3.5 / 4.0 / 4.5', 'rated_lines', false],
    ['Mixed Tri-Level', '6.0 / 7.0 / 8.0', 'combined_rated_lines', true],
    ['Club Open Doubles', 'Open', 'open', false],
  ] as const)('resolves eligibility for %s / %s', (leagueName, flight, ratingRule, requiresMixedPair) => {
    const rules = resolveTeamCompetitionRules({ leagueName, flight })
    expect(rules.ratingRule).toBe(ratingRule)
    expect(rules.requiresMixedPair).toBe(requiresMixedPair)
  })

  it('checks straight-level player eligibility', () => {
    const rules = resolveTeamCompetitionRules({ leagueName: 'Adult 18 & Over', flight: 'Women 4.0' })
    expect(isCompetitionPlayerRatingEligible(rules, 4)).toBe(true)
    expect(isCompetitionPlayerRatingEligible(rules, 3.5)).toBe(true)
    expect(isCompetitionPlayerRatingEligible(rules, 3)).toBe(false)
    expect(isCompetitionPlayerRatingEligible(rules, 4.5)).toBe(false)
    expect(isCompetitionPlayerRatingEligible(rules, null)).toBe(true)
  })

  it('checks combined-level totals and partner spread', () => {
    const rules = resolveTeamCompetitionRules({ leagueName: 'Mixed 18 & Over', flight: '8.0' })
    expect(rules.minimumPlayerRating).toBe(3.5)
    expect(isCompetitionPlayerRatingEligible(rules, 3)).toBe(false)
    expect(isCompetitionPlayerRatingEligible(rules, 3.5)).toBe(true)
    expect(isCompetitionPairRatingEligible(rules, [4, 4])).toBe(true)
    expect(isCompetitionPairRatingEligible(rules, [4.5, 3.5])).toBe(true)
    expect(getCompetitionPairRatingIssues(rules, [4.5, 4])).toContain('Pair rating 4.5 + 4.0 exceeds 8.0.')
    expect(getCompetitionPairRatingIssues(rules, [4.5, 3])).toContain('Partners differ by more than 1.0.')
  })

  it('uses the court level for mixed Tri-Level pair validation', () => {
    const rules = resolveTeamCompetitionRules({ leagueName: 'Mixed Tri-Level', flight: '6.0 / 7.0 / 8.0' })
    expect(isCompetitionPairRatingEligible(rules, [3.5, 3.5], 7)).toBe(true)
    expect(isCompetitionPairRatingEligible(rules, [4, 3.5], 7)).toBe(false)
  })

  it('explains odd and even team scorecards', () => {
    const odd = resolveTeamCompetitionRules({ explicitFormatId: 'standard_2s_3d' })
    const even = resolveTeamCompetitionRules({ explicitFormatId: 'four_doubles' })
    expect(odd.teamResultDetail).toContain('First to 3 line wins')
    expect(even.teamResultDetail).toContain('2-2 tie is possible')
  })

  it('keeps dynamic-point standings and tournament advancement explicit', () => {
    const rules = resolveTeamCompetitionRules({
      explicitFormatId: 'three_doubles',
      scoringSystem: 'dynamic_points',
    })
    expect(rules.standingsDetail).toContain('total points first')
    expect(getTournamentOperationsSummary('round_robin')).toContain('Standings use wins')
    expect(getTournamentOperationsSummary('team_tournament')).toContain('team scorecard')
  })
})
