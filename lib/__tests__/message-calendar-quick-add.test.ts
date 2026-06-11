import { describe, expect, it } from 'vitest'

import { buildCalendarQuickAddItemId, detectCalendarQuickAddCandidate } from '../message-calendar-quick-add'

describe('message calendar quick add parser', () => {
  it('detects ISO dates with 24-hour time and location', () => {
    expect(
      detectCalendarQuickAddCandidate(
        'Serve reps on 2026-06-18 18:30 at Court 4.',
        'Fallback',
        'reply draft',
      ),
    ).toEqual({
      title: 'Serve reps',
      date: '2026-06-18',
      time: '18:30',
      location: 'Court 4',
      kind: 'reminder',
      availabilityStatus: '',
      recurrenceRule: '',
      sourceLabel: 'reply draft',
    })
  })

  it('detects slash dates with 12-hour time and location', () => {
    expect(
      detectCalendarQuickAddCandidate(
        'Doubles practice 6/18/2026 at 6:30 PM @ Indoor Court 2',
        'Fallback',
        'new message',
      ),
    ).toMatchObject({
      title: 'Doubles practice',
      date: '2026-06-18',
      time: '18:30',
      location: 'Indoor Court 2',
    })
  })

  it('detects month-name dates with compact time', () => {
    expect(
      detectCalendarQuickAddCandidate(
        'Match prep June 18, 2026 6pm at Forest Lake',
        'Fallback',
        'latest message',
      ),
    ).toMatchObject({
      title: 'Match prep',
      date: '2026-06-18',
      time: '18:00',
      location: 'Forest Lake',
    })
  })

  it('detects availability language before concrete dates', () => {
    expect(
      detectCalendarQuickAddCandidate(
        "I'm unavailable 6/18/2026 at 6pm",
        'Fallback',
        'reply draft',
      ),
    ).toMatchObject({
      title: 'Unavailable',
      date: '2026-06-18',
      time: '18:00',
      kind: 'availability',
      availabilityStatus: 'unavailable',
    })

    expect(
      detectCalendarQuickAddCandidate(
        'Available June 20, 2026 at 9am',
        'Fallback',
        'reply draft',
      ),
    ).toMatchObject({
      title: 'Available',
      date: '2026-06-20',
      time: '09:00',
      kind: 'availability',
      availabilityStatus: 'available',
    })
  })

  it('detects availability language after concrete dates', () => {
    expect(
      detectCalendarQuickAddCandidate(
        '6/21/2026 at 10am unavailable',
        'Fallback',
        'thread message',
      ),
    ).toMatchObject({
      title: 'Unavailable',
      date: '2026-06-21',
      time: '10:00',
      kind: 'availability',
      availabilityStatus: 'unavailable',
    })

    expect(
      detectCalendarQuickAddCandidate(
        '6/22/2026 11am open',
        'Fallback',
        'thread message',
      ),
    ).toMatchObject({
      title: 'Available',
      date: '2026-06-22',
      time: '11:00',
      kind: 'availability',
      availabilityStatus: 'available',
    })
  })

  it('detects recurrence language around concrete dates', () => {
    expect(
      detectCalendarQuickAddCandidate(
        'Weekly doubles practice 6/24/2026 at 6pm @ Court 1',
        'Fallback',
        'reply draft',
      ),
    ).toMatchObject({
      title: 'Weekly doubles practice',
      date: '2026-06-24',
      time: '18:00',
      recurrenceRule: 'FREQ=WEEKLY',
    })

    expect(
      detectCalendarQuickAddCandidate(
        '6/25/2026 7am every day',
        'Fallback',
        'reply draft',
      ),
    ).toMatchObject({
      date: '2026-06-25',
      time: '07:00',
      recurrenceRule: 'FREQ=DAILY',
    })

    expect(
      detectCalendarQuickAddCandidate(
        'Video check-in 6/26/2026 at 8pm monthly',
        'Fallback',
        'reply draft',
      ),
    ).toMatchObject({
      title: 'Video check-in',
      date: '2026-06-26',
      time: '20:00',
      recurrenceRule: 'FREQ=MONTHLY',
    })
  })

  it('saves recurring availability from message language', () => {
    expect(
      detectCalendarQuickAddCandidate(
        'Unavailable every week 6/27/2026 at 5pm',
        'Fallback',
        'thread message',
      ),
    ).toMatchObject({
      title: 'Unavailable',
      date: '2026-06-27',
      kind: 'availability',
      availabilityStatus: 'unavailable',
      recurrenceRule: 'FREQ=WEEKLY',
    })
  })

  it('requires concrete valid dates', () => {
    expect(detectCalendarQuickAddCandidate('Hit next Tuesday at 6pm', 'Fallback', 'reply draft')).toBeNull()
    expect(detectCalendarQuickAddCandidate('Hit 2/31/2026 at 6pm', 'Fallback', 'reply draft')).toBeNull()
  })

  it('builds stable calendar item ids for duplicate-safe message saves', () => {
    const candidate = detectCalendarQuickAddCandidate(
      'Doubles practice 6/18/2026 at 6:30 PM @ Indoor Court 2',
      'Fallback',
      'new message',
    )
    const laterCandidate = detectCalendarQuickAddCandidate(
      'Doubles practice 6/18/2026 at 7:30 PM @ Indoor Court 2',
      'Fallback',
      'new message',
    )

    expect(candidate).not.toBeNull()
    expect(laterCandidate).not.toBeNull()
    if (!candidate || !laterCandidate) return

    const firstId = buildCalendarQuickAddItemId(candidate, 'thread-conversation-1-reply')
    const secondId = buildCalendarQuickAddItemId(candidate, 'thread-conversation-1-reply')

    expect(firstId).toBe(secondId)
    expect(firstId).toMatch(/^message-calendar-thread-conversation-1-reply-2026-06-18-18-30-/)
    expect(firstId.length).toBeLessThanOrEqual(96)
    expect(buildCalendarQuickAddItemId(laterCandidate, 'thread-conversation-1-reply')).not.toBe(firstId)
  })
})
