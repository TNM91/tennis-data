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
