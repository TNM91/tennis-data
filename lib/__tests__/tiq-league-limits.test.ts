import { describe, expect, it } from 'vitest'

import {
  calculateTiqLeagueEndsOn,
  DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS,
  DEFAULT_TIQ_LEAGUE_MAX_WEEKS,
  getTiqLeagueRoundRobinEventCount,
  getTiqLeagueScheduleCapacitySummary,
  normalizeTiqLeagueMaxMatchEvents,
  normalizeTiqLeagueMaxWeeks,
  normalizeTiqLeagueSeasonStatus,
  validateTiqLeagueCanAcceptActivity,
  validateTiqLeagueScheduleCapacity,
  validateTiqLeagueSeasonWindow,
} from '../tiq-league-limits'

describe('tiq league limits', () => {
  it('normalizes season controls to conservative defaults', () => {
    expect(normalizeTiqLeagueSeasonStatus('active')).toBe('active')
    expect(normalizeTiqLeagueSeasonStatus('unknown')).toBe('draft')
    expect(normalizeTiqLeagueMaxWeeks(null)).toBe(DEFAULT_TIQ_LEAGUE_MAX_WEEKS)
    expect(normalizeTiqLeagueMaxWeeks(100)).toBe(12)
    expect(normalizeTiqLeagueMaxMatchEvents(null)).toBe(DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS)
    expect(normalizeTiqLeagueMaxMatchEvents(999)).toBe(500)
  })

  it('blocks seasons that exceed their configured date window', () => {
    expect(validateTiqLeagueSeasonWindow({
      startsOn: '2026-01-01',
      endsOn: '2026-03-31',
      maxWeeks: 8,
    })).toContain('Raise the max weeks')

    expect(validateTiqLeagueSeasonWindow({
      startsOn: '2026-01-01',
      endsOn: '2026-01-31',
      maxWeeks: 8,
    })).toBeNull()
  })

  it('derives the end date from the start date and capped season length', () => {
    expect(calculateTiqLeagueEndsOn('2026-01-01', 1)).toBe('2026-01-07')
    expect(calculateTiqLeagueEndsOn('2026-01-01', 12)).toBe('2026-03-25')
    expect(calculateTiqLeagueEndsOn('2026-01-01', 100)).toBe('2026-03-25')
    expect(calculateTiqLeagueEndsOn('', 12)).toBe('')
  })

  it('blocks closed seasons, over-limit activity, and out-of-window results', () => {
    const record = {
      seasonStatus: 'active' as const,
      startsOn: '2026-01-01',
      endsOn: '2026-03-31',
      maxMatchEvents: 3,
    }

    expect(validateTiqLeagueCanAcceptActivity(record, 2, '2026-02-01')).toBeNull()
    expect(validateTiqLeagueCanAcceptActivity(record, 3, '2026-02-01')).toContain('season limit')
    expect(validateTiqLeagueCanAcceptActivity(record, 1, '2026-04-01')).toContain('after the league season ends')
    expect(validateTiqLeagueCanAcceptActivity({ ...record, seasonStatus: 'completed' }, 1, '2026-02-01')).toContain('closed')
  })

  it('estimates round-robin schedule capacity from participants', () => {
    const teamRecord = {
      leagueFormat: 'team' as const,
      teams: ['Aces', 'Baseliners', 'Courtside', 'Dropshots'],
      players: [],
      maxMatchEvents: 5,
    }

    expect(getTiqLeagueRoundRobinEventCount(teamRecord)).toBe(6)
    expect(getTiqLeagueScheduleCapacitySummary(teamRecord)).toBe(
      '4 teams need 6 match events for one round robin.',
    )
    expect(validateTiqLeagueScheduleCapacity(teamRecord)).toContain('season is capped at 5')
    expect(validateTiqLeagueScheduleCapacity({ ...teamRecord, maxMatchEvents: 6 })).toBeNull()
  })

  it('handles individual league schedule capacity copy', () => {
    expect(getTiqLeagueScheduleCapacitySummary({
      leagueFormat: 'individual',
      teams: [],
      players: ['A'],
      maxMatchEvents: 10,
    })).toBe('Add at least two players to estimate schedule capacity.')

    expect(getTiqLeagueScheduleCapacitySummary({
      leagueFormat: 'individual',
      teams: [],
      players: ['A', 'B', 'C'],
      maxMatchEvents: 10,
    })).toBe('3 players need 3 match events for one round robin.')
  })
})

