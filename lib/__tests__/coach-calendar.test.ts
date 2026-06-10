import { describe, expect, it } from 'vitest'

import { buildCoachStudentCalendarEvents } from '../coach-calendar'
import { buildTennisCalendarFeed } from '../tiq-league-schedule-calendar'
import type { CoachAssignment, CoachStudentLink } from '../coach-storage'

function assignment(overrides: Partial<CoachAssignment>): CoachAssignment {
  return {
    id: 'assignment-1',
    studentLinkId: 'student-1',
    title: 'Serve target ladder',
    focus: 'Serve + first ball',
    dueDate: '2026-06-14',
    status: 'assigned',
    assignment: {
      lessonDateTime: '2026-06-12T16:30',
      lessonFocus: 'Serve rhythm',
      lessonLocation: 'Court 7',
    },
    updatedAt: '2026-06-09T12:00:00.000Z',
    ...overrides,
  }
}

const student: Pick<CoachStudentLink, 'id' | 'playerName'> = {
  id: 'student-1',
  playerName: 'Taylor Player',
}

describe('coach calendar events', () => {
  it('links coach/student lesson time and assignment due dates into calendar events', () => {
    const events = buildCoachStudentCalendarEvents([assignment({})], student)

    expect(events).toEqual([
      expect.objectContaining({
        id: 'coach-lesson-assignment-1',
        title: 'Lesson: Taylor Player',
        date: '2026-06-12',
        time: '16:30',
        location: 'Court 7',
        durationMinutes: 60,
      }),
      expect.objectContaining({
        id: 'coach-assignment-assignment-1',
        title: 'Coach assignment due: Serve target ladder',
        date: '2026-06-14',
      }),
    ])

    const feed = buildTennisCalendarFeed(events, {
      calendarName: 'Taylor Player coach calendar',
      productUrl: 'https://tenaceiq.com',
    })

    expect(feed).toContain('X-WR-CALNAME:Taylor Player coach calendar')
    expect(feed).toContain('SUMMARY:Lesson: Taylor Player')
    expect(feed).toContain('LOCATION:Court 7')
    expect(feed).toContain('DESCRIPTION:Coach/student lesson for Taylor Player.\\nFocus: Serve rhythm\\nLocation: Court 7\\nFollow-up: Serve target ladder')
    expect(feed).toContain('DTSTART;TZID=America/Chicago:20260612T163000')
    expect(feed).toContain('DTEND;TZID=America/Chicago:20260612T173000')
    expect(feed).toContain('SUMMARY:Coach assignment due: Serve target ladder')
    expect(feed).toContain('DTSTART;VALUE=DATE:20260614')
  })

  it('skips draft and archived coach assignments', () => {
    expect(
      buildCoachStudentCalendarEvents([
        assignment({ id: 'draft', status: 'draft' }),
        assignment({ id: 'archived', status: 'archived' }),
      ], student),
    ).toEqual([])
  })
})
