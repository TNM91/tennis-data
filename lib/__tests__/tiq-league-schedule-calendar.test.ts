import { describe, expect, it } from 'vitest'

import { buildScheduleCalendarDays, buildScheduleCalendarFeed, buildTennisCalendarFeed } from '../tiq-league-schedule-calendar'
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

  it('builds an iCal feed for external calendar subscriptions', () => {
    const feed = buildScheduleCalendarFeed([
      scheduleItem({
        id: 'scheduled',
        participantAName: 'Alice, A',
        participantBName: 'Bob; B',
        scheduledDate: '2026-02-01',
        scheduledTime: '09:00',
        facility: 'Court 1',
        notes: 'Bring balls\nUse indoor courts',
      }),
      scheduleItem({
        id: 'cancelled',
        status: 'cancelled',
        scheduledDate: '2026-02-02',
      }),
    ], {
      calendarName: 'TIQ League Calendar',
      productUrl: 'https://tenaceiq.com/compete/schedule',
      timeZone: 'America/New_York',
      durationMinutes: 120,
    })

    expect(feed).toContain('BEGIN:VCALENDAR')
    expect(feed).toContain('X-WR-CALNAME:TIQ League Calendar')
    expect(feed).toContain('UID:scheduled@tenaceiq.com')
    expect(feed).toContain('SUMMARY:Alice\\, A vs Bob\\; B')
    expect(feed).toContain('LOCATION:Court 1')
    expect(feed).toContain('DESCRIPTION:Individual league match\\nBring balls\\nUse indoor courts\\nStatus: confirmed')
    expect(feed).toContain('DTSTART;TZID=America/New_York:20260201T090000')
    expect(feed).toContain('DTEND;TZID=America/New_York:20260201T110000')
    expect(feed).toContain('URL:https://tenaceiq.com/compete/schedule')
    expect(feed).not.toContain('UID:cancelled@tenaceiq.com')
  })

  it('uses all-day events when a schedule row has no time', () => {
    const feed = buildScheduleCalendarFeed([
      scheduleItem({
        id: 'all-day',
        scheduledDate: '2026-02-01',
        scheduledTime: '',
      }),
    ])

    expect(feed).toContain('DTSTART;VALUE=DATE:20260201')
    expect(feed).toContain('DTEND;VALUE=DATE:20260202')
  })

  it('builds shared tennis calendar feeds from generic event records', () => {
    const feed = buildTennisCalendarFeed([
      {
        id: 'coach-lesson-1',
        title: 'Lesson: Taylor Player',
        date: '2026-06-12',
        time: '16:30',
        description: 'Coach/student lesson\nFocus: Serve + first ball',
        url: 'https://tenaceiq.com/coach#coach-lesson-frame',
        durationMinutes: 60,
      },
    ], {
      calendarName: 'Coach + student lessons',
      timeZone: 'America/Chicago',
    })

    expect(feed).toContain('X-WR-CALNAME:Coach + student lessons')
    expect(feed).toContain('UID:coach-lesson-1@tenaceiq.com')
    expect(feed).toContain('SUMMARY:Lesson: Taylor Player')
    expect(feed).toContain('DESCRIPTION:Coach/student lesson\\nFocus: Serve + first ball')
    expect(feed).toContain('DTSTART;TZID=America/Chicago:20260612T163000')
    expect(feed).toContain('DTEND;TZID=America/Chicago:20260612T173000')
    expect(feed).toContain('URL:https://tenaceiq.com/coach#coach-lesson-frame')
  })
})
