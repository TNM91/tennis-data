import { describe, expect, it } from 'vitest'

import { buildScheduleCalendarDays } from '../tiq-league-schedule-calendar'
import type { TiqLeagueScheduleItem } from '../tiq-league-schedule-service'

function scheduleItem(overrides: Partial<TiqLeagueScheduleItem>): TiqLeagueScheduleItem {
  return {
    id: 'schedule-1',
    leagueId: 'league-1',
    leagueFormat: 'individual',
    participantAName: 'Alice',
    participantAId: '',
    participantBName: 'Bob',
    participantBId: '',
    scheduledDate: '2026-02-01',
    scheduledTime: '09:00',
    facility: '',
    status: 'confirmed',
    notes: '',
    proposedByUserId: '',
    confirmedByUserId: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('buildScheduleCalendarDays', () => {
  it('groups scheduled matches by date in calendar order', () => {
    const days = buildScheduleCalendarDays([
      scheduleItem({ id: 'late', scheduledDate: '2026-02-08' }),
      scheduleItem({ id: 'early-a', scheduledDate: '2026-02-01' }),
      scheduleItem({ id: 'early-b', scheduledDate: '2026-02-01' }),
    ])

    expect(days.map((day) => day.date)).toEqual(['2026-02-01', '2026-02-08'])
    expect(days[0].items.map((item) => item.id)).toEqual(['early-a', 'early-b'])
    expect(days[0].label).toContain('Feb')
  })

  it('keeps unscheduled matches last', () => {
    const days = buildScheduleCalendarDays([
      scheduleItem({ id: 'unscheduled', scheduledDate: '' }),
      scheduleItem({ id: 'scheduled', scheduledDate: '2026-02-01' }),
    ])

    expect(days.map((day) => day.date)).toEqual(['2026-02-01', 'unscheduled'])
    expect(days[1]).toMatchObject({
      label: 'Date TBD',
      dayLabel: 'TBD',
    })
  })
})
