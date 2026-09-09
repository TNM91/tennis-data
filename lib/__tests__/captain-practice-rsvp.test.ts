import { describe, expect, it } from 'vitest'
import {
  assignPracticeDisplayStatuses,
  buildPracticeGoogleCalendarHref,
  buildPracticeIcs,
  practiceRsvpPath,
  resolvePracticeToken,
} from '../captain-practice-rsvp'

describe('captain practice RSVP', () => {
  it('uses a short, lossless public path', () => {
    const token = '123e4567-e89b-42d3-a456-426614174000'
    const path = practiceRsvpPath(token)

    expect(path).toMatch(/^\/pr\/[A-Za-z0-9_-]{22}$/)
    expect(resolvePracticeToken(path.split('/').pop() || '')).toBe(token)
  })

  it('moves later in-responses to the waitlist when practice is full', () => {
    const roster = assignPracticeDisplayStatuses([
      { playerName: 'First', responseStatus: 'in' as const, respondedAt: '2026-09-09T10:00:00.000Z' },
      { playerName: 'Third', responseStatus: 'in' as const, respondedAt: '2026-09-09T10:02:00.000Z' },
      { playerName: 'Second', responseStatus: 'in' as const, respondedAt: '2026-09-09T10:01:00.000Z' },
      { playerName: 'Maybe', responseStatus: 'maybe' as const, respondedAt: '2026-09-09T10:03:00.000Z' },
    ], 2)

    expect(roster.map((player) => [player.playerName, player.displayStatus])).toEqual([
      ['First', 'in'],
      ['Third', 'waitlist'],
      ['Second', 'in'],
      ['Maybe', 'maybe'],
    ])
  })

  it('builds phone and Google calendar handoffs for a 90-minute practice', () => {
    const input = {
      teamName: 'SuperSmash',
      scheduledDate: '2026-09-16',
      scheduledTime: '20:00',
      facility: 'Vetta West',
      notes: 'Doubles patterns',
    }
    const ics = buildPracticeIcs({ ...input, uid: 'practice-1' })
    const google = buildPracticeGoogleCalendarHref(input)

    expect(ics).toContain('SUMMARY:SuperSmash practice')
    expect(ics).toContain('DTSTART:20260916T200000')
    expect(ics).toContain('DTEND:20260916T213000')
    expect(google).toContain('calendar.google.com/calendar/render')
    expect(google).toContain('Vetta+West')
  })
})
