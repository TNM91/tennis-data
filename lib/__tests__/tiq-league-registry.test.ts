import { describe, expect, it } from 'vitest'
import {
  getTiqLeagueSchedulingModeDescription,
  getTiqLeagueSchedulingModeLabel,
  getTiqLeagueScoringSystemDescription,
  getTiqLeagueScoringSystemLabel,
  getTiqLeagueThirdSetRuleDescription,
  getTiqLeagueThirdSetRuleLabel,
  getTiqLeagueVisibilityDescription,
  getTiqLeagueVisibilityLabel,
  normalizeTiqLeagueScheduleTimeZone,
  normalizeTiqLeagueSchedulingMode,
  normalizeTiqLeagueScoringSystem,
  normalizeTiqLeagueThirdSetRule,
  normalizeTiqLeagueVisibility,
  parseRegistryListInput,
} from '../tiq-league-registry'

describe('TIQ league registry helpers', () => {
  it('normalizes league setup defaults for coordinator-created leagues', () => {
    expect(normalizeTiqLeagueScoringSystem(null)).toBe('standard')
    expect(normalizeTiqLeagueScoringSystem('dynamic_points')).toBe('dynamic_points')
    expect(normalizeTiqLeagueThirdSetRule(null)).toBe('either')
    expect(normalizeTiqLeagueThirdSetRule('full_set')).toBe('full_set')
    expect(normalizeTiqLeagueThirdSetRule('match_tiebreak_10')).toBe('match_tiebreak_10')
    expect(normalizeTiqLeagueThirdSetRule('superbreaker')).toBe('either')
    expect(normalizeTiqLeagueSchedulingMode('player_arranged')).toBe('player_arranged')
    expect(normalizeTiqLeagueSchedulingMode('legacy')).toBe('coordinator_fixed')
    expect(normalizeTiqLeagueScheduleTimeZone('')).toBe('America/Chicago')
    expect(normalizeTiqLeagueScheduleTimeZone(' America/New_York ')).toBe('America/New_York')
    expect(normalizeTiqLeagueVisibility(false)).toBe('private')
    expect(normalizeTiqLeagueVisibility('public')).toBe('public')
  })

  it('keeps coordinator and player scheduling copy clear', () => {
    expect(getTiqLeagueSchedulingModeLabel('coordinator_fixed')).toBe('Coordinator schedule')
    expect(getTiqLeagueSchedulingModeDescription('coordinator_fixed')).toContain(
      'recurring match day, time, and site',
    )

    expect(getTiqLeagueSchedulingModeLabel('player_arranged')).toBe('Players schedule')
    expect(getTiqLeagueSchedulingModeDescription('player_arranged')).toContain(
      'Players schedule through TenAceIQ',
    )
  })

  it('explains Standard wins without hiding third-set options', () => {
    expect(getTiqLeagueScoringSystemLabel('standard')).toBe('Standard wins')
    expect(getTiqLeagueScoringSystemDescription('standard')).toContain('Best 2 of 3 sets')
    expect(getTiqLeagueScoringSystemDescription('standard')).toContain('10-point match tiebreak')
    expect(getTiqLeagueScoringSystemLabel('dynamic_points')).toBe('Dynamic points')
    expect(getTiqLeagueScoringSystemDescription('dynamic_points')).toContain('Straight-set winner 14')
  })

  it('labels explicit third-set rules for coordinator setup', () => {
    expect(getTiqLeagueThirdSetRuleLabel('either')).toBe('Full set or 10-point tiebreak')
    expect(getTiqLeagueThirdSetRuleDescription('either')).toContain('local league rules')
    expect(getTiqLeagueThirdSetRuleLabel('full_set')).toBe('Full third set')
    expect(getTiqLeagueThirdSetRuleDescription('full_set')).toContain('regular tennis sets')
    expect(getTiqLeagueThirdSetRuleLabel('match_tiebreak_10')).toBe('10-point match tiebreak')
    expect(getTiqLeagueThirdSetRuleDescription('match_tiebreak_10')).toContain('1-0')
  })

  it('states league visibility without implying open access', () => {
    expect(getTiqLeagueVisibilityLabel(true)).toBe('Public page')
    expect(getTiqLeagueVisibilityDescription(true)).toContain('approval')
    expect(getTiqLeagueVisibilityLabel(false)).toBe('Private league')
    expect(getTiqLeagueVisibilityDescription(false)).toContain('hidden from public browse pages')
  })

  it('deduplicates roster and participant list input from uploads or manual paste', () => {
    expect(parseRegistryListInput('Aces, Baseliners\nAces\n  Net Rushers  ')).toEqual([
      'Aces',
      'Baseliners',
      'Net Rushers',
    ])
  })
})
