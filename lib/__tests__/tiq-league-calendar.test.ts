import { describe, expect, it } from 'vitest'
import {
  addDaysToDateString,
  buildTiqLeagueSeasonCalendarRows,
  buildTiqLeagueSchedulingPlanRows,
  getFirstScheduledDate,
  getTiqLeagueSchedulingHandoffSummary,
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

  it('turns coordinator schedules into publish-ready weekly rows', () => {
    const rows = buildTiqLeagueSchedulingPlanRows({
      startsOn: '2026-05-04',
      maxWeeks: 1,
      defaultMatchDay: 'Wednesday',
      defaultMatchTime: '19:00',
      defaultFacility: 'Court 4',
      schedulingMode: 'coordinator_fixed',
    })

    expect(rows[0]).toMatchObject({
      mode: 'coordinator_fixed',
      label: '2026-05-06',
      meta: '19:00 | Court 4',
      action: 'Coordinator publishes',
      windowStart: '2026-05-06',
      windowEnd: '2026-05-06',
    })
  })

  it('turns player-arranged schedules into weekly scheduling windows', () => {
    const rows = buildTiqLeagueSchedulingPlanRows({
      startsOn: '2026-05-04',
      maxWeeks: 1,
      defaultMatchDay: 'Monday',
      defaultMatchTime: '19:00',
      defaultFacility: 'Court 4',
      schedulingMode: 'player_arranged',
    })

    expect(rows[0]).toMatchObject({
      mode: 'player_arranged',
      label: '2026-05-04 to 2026-05-10',
      meta: 'Pairing window opens. Players propose and confirm date, time, and site.',
      action: 'Players confirm',
      windowStart: '2026-05-04',
      windowEnd: '2026-05-10',
    })
  })

  it('explains scheduling handoff after league setup', () => {
    expect(getTiqLeagueSchedulingHandoffSummary({
      startsOn: '2026-05-04',
      maxWeeks: 3,
      schedulingMode: 'coordinator_fixed',
      scheduleTimeZone: 'America/Chicago',
    })).toContain('coordinator publishes the default match day, time, and site')

    expect(getTiqLeagueSchedulingHandoffSummary({
      startsOn: '2026-05-04',
      maxWeeks: 3,
      schedulingMode: 'player_arranged',
      scheduleTimeZone: 'America/Chicago',
    })).toContain('players propose and confirm the exact date, time, and site')

    expect(getTiqLeagueSchedulingHandoffSummary({ startsOn: '', maxWeeks: 3 })).toContain('Choose a start date')
  })
})
