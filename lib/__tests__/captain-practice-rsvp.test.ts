import { describe, expect, it } from 'vitest'
import {
  assignPracticeDisplayStatuses,
  buildPracticeGoogleCalendarHref,
  buildPracticeIcs,
  practiceRsvpPath,
  resolvePracticeToken,
} from '../captain-practice-rsvp'
import { buildCaptainPracticeInviteText } from '../captain-practice-invite'

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

  it('keeps captain-confirmed players in the practice when capacity is full', () => {
    const roster = assignPracticeDisplayStatuses([
      { playerName: 'Early signup', responseStatus: 'in' as const, respondedAt: '2026-09-09T10:00:00.000Z', captainConfirmedAt: '' },
      { playerName: 'Captain pick', responseStatus: 'in' as const, respondedAt: '2026-09-09T10:02:00.000Z', captainConfirmedAt: '2026-09-09T11:00:00.000Z' },
    ], 1)

    expect(roster.map((player) => [player.playerName, player.displayStatus])).toEqual([
      ['Early signup', 'waitlist'],
      ['Captain pick', 'in'],
    ])
  })

  it('uses the captain-selected end time for phone and Google calendar handoffs', () => {
    const input = {
      teamName: 'SuperSmash',
      scheduledDate: '2026-09-16',
      scheduledTime: '20:00',
      scheduledEndTime: '22:00',
      facility: 'Vetta West',
      notes: 'Doubles patterns',
    }
    const ics = buildPracticeIcs({ ...input, uid: 'practice-1' })
    const google = buildPracticeGoogleCalendarHref(input)

    expect(ics).toContain('SUMMARY:SuperSmash practice')
    expect(ics).toContain('DTSTART:20260916T200000')
    expect(ics).toContain('DTEND:20260916T220000')
    expect(google).toContain('calendar.google.com/calendar/render')
    expect(google).toContain('Vetta+West')
  })

  it('keeps a 90-minute calendar fallback for older practices without an end time', () => {
    const ics = buildPracticeIcs({
      uid: 'legacy-practice',
      teamName: 'SuperSmash',
      scheduledDate: '2026-09-16',
      scheduledTime: '20:00',
      facility: 'Vetta West',
    })

    expect(ics).toContain('DTEND:20260916T213000')
  })

  it('puts the start and end time in the group-text invite', () => {
    const invite = buildCaptainPracticeInviteText({
      teamName: 'SuperSmash',
      scheduledDate: '2026-09-16',
      scheduledTime: '20:00',
      scheduledEndTime: '22:00',
      responseUrl: 'https://tenaceiq.com/pr/example',
    })

    expect(invite).toContain('8:00 PM–10:00 PM')
  })
})
