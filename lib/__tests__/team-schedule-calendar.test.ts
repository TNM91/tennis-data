import { describe, expect, it } from 'vitest'
import {
  buildTeamScheduleCalendarItems,
  normalizeScheduleCalendarDate,
  normalizeScheduleCalendarTime,
} from '../team-schedule-calendar'

describe('team schedule calendar items', () => {
  it('turns a reviewed team schedule into stable personal calendar matches', () => {
    const items = buildTeamScheduleCalendarItems({
      teamName: 'Meinert/The Other Guys (S)',
      leagueName: '2026 Adult 18 & Over Spring',
      calendarOwnerId: 'player-1',
      matches: [
        {
          externalMatchId: '1011650666',
          matchDate: '1/18/2026',
          matchTime: '5:30 PM',
          homeTeam: 'Hodge/Kamman (S)',
          awayTeam: 'Meinert/The Other Guys (S)',
          facility: 'St. Clair Tennis Club',
        },
      ],
    })

    expect(items).toEqual([
      expect.objectContaining({
        id: 'team-schedule-player-1-meinert-the-other-guys-s-1011650666',
        title: 'Meinert/The Other Guys (S) vs Hodge/Kamman (S) · 2026 Adult 18 & Over Spring',
        date: '2026-01-18',
        time: '17:30',
        location: 'St. Clair Tennis Club',
        kind: 'match',
      }),
    ])
  })

  it('skips rows without a usable date and removes duplicates', () => {
    const items = buildTeamScheduleCalendarItems({
      teamName: 'The Other Guys',
      matches: [
        { externalMatchId: 'match-1', matchDate: '2026-03-01', homeTeam: 'The Other Guys', awayTeam: 'Aces' },
        { externalMatchId: 'match-1', matchDate: '2026-03-01', homeTeam: 'The Other Guys', awayTeam: 'Aces' },
        { externalMatchId: 'match-2', matchDate: 'not scheduled', homeTeam: 'The Other Guys', awayTeam: 'Volleys' },
      ],
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ date: '2026-03-01', time: '' })
  })

  it('keeps the same team schedule private to each player calendar', () => {
    const base = {
      teamName: 'The Other Guys',
      matches: [{ externalMatchId: 'match-1', matchDate: '2026-03-01', homeTeam: 'The Other Guys', awayTeam: 'Aces' }],
    }

    expect(buildTeamScheduleCalendarItems({ ...base, calendarOwnerId: 'player-a' })[0]?.id)
      .not.toBe(buildTeamScheduleCalendarItems({ ...base, calendarOwnerId: 'player-b' })[0]?.id)
  })

  it('normalizes the schedule formats Data Assist reads', () => {
    expect(normalizeScheduleCalendarDate('2/8/2026')).toBe('2026-02-08')
    expect(normalizeScheduleCalendarDate('2026-02-08')).toBe('2026-02-08')
    expect(normalizeScheduleCalendarTime('9:00 AM')).toBe('09:00')
    expect(normalizeScheduleCalendarTime('12:30 PM')).toBe('12:30')
    expect(normalizeScheduleCalendarTime('12:30 AM')).toBe('00:30')
  })
})
