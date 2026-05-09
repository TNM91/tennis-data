import { describe, expect, it } from 'vitest'
import {
  getTiqLeagueSchedulingModeDescription,
  getTiqLeagueSchedulingModeLabel,
  getTiqLeagueScoringSystemDescription,
  getTiqLeagueScoringSystemLabel,
  getTiqLeagueVisibilityDescription,
  getTiqLeagueVisibilityLabel,
  normalizeTiqLeagueScheduleTimeZone,
  normalizeTiqLeagueSchedulingMode,
  normalizeTiqLeagueScoringSystem,
  normalizeTiqLeagueVisibility,
  parseRegistryListInput,
} from '../tiq-league-registry'

describe('TIQ league registry helpers', () => {
  it('normalizes league setup defaults for coordinator-created leagues', () => {
    expect(normalizeTiqLeagueScoringSystem(null)).toBe('standard')
    expect(normalizeTiqLeagueScoringSystem('dynamic_points')).toBe('dynamic_points')
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
