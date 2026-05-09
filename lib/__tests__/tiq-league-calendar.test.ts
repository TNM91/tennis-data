import { describe, expect, it } from 'vitest'
import {
  addDaysToDateString,
  buildTiqLeagueSeasonCalendarRows,
  getFirstScheduledDate,
} from '../tiq-league-calendar'

describe('TIQ league calendar helpers', () => {
  it('calculates the first recurring match day on or after the start date', () => {
    expect(getFirstScheduledDate('2026-05-04', 'Monday')).toBe('2026-05-04')
    expect(getFirstScheduledDate('2026-05-04', 'Thursday')).toBe('2026-05-07')
    expect(getFirstScheduledDate('2026-05-04', '')).toBe('2026-05-04')
  })

  it('builds a capped weekly season calendar with default time and site', () => {
    const rows = buildTiqLeagueSeasonCalendarRows({
      startsOn: '2026-05-04',
      maxWeeks: 3,
      defaultMatchDay: 'Wednesday',
      defaultMatchTime: '7:00 PM',
      defaultFacility: 'Court 4',
    })

    expect(rows).toEqual([
      { week: 1, date: '2026-05-06', time: '7:00 PM', site: 'Court 4' },
      { week: 2, date: '2026-05-13', time: '7:00 PM', site: 'Court 4' },
      { week: 3, date: '2026-05-20', time: '7:00 PM', site: 'Court 4' },
    ])
  })

  it('keeps invalid dates blank instead of publishing bad schedule rows', () => {
    expect(addDaysToDateString('not-a-date', 7)).toBe('')
    expect(buildTiqLeagueSeasonCalendarRows({ startsOn: '', maxWeeks: 2 })).toEqual([
      { week: 1, date: '', time: '', site: '' },
      { week: 2, date: '', time: '', site: '' },
    ])
  })
})
