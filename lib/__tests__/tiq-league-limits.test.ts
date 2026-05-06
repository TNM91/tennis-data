import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS,
  DEFAULT_TIQ_LEAGUE_MAX_WEEKS,
  normalizeTiqLeagueMaxMatchEvents,
  normalizeTiqLeagueMaxWeeks,
  normalizeTiqLeagueSeasonStatus,
  validateTiqLeagueCanAcceptActivity,
  validateTiqLeagueSeasonWindow,
} from '../tiq-league-limits'

describe('tiq league limits', () => {
  it('normalizes season controls to conservative defaults', () => {
    expect(normalizeTiqLeagueSeasonStatus('active')).toBe('active')
    expect(normalizeTiqLeagueSeasonStatus('unknown')).toBe('draft')
    expect(normalizeTiqLeagueMaxWeeks(null)).toBe(DEFAULT_TIQ_LEAGUE_MAX_WEEKS)
    expect(normalizeTiqLeagueMaxWeeks(100)).toBe(52)
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
})

