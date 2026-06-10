import { describe, expect, it, vi } from 'vitest'

import {
  buildPlayerCalendarItemPayload,
  mapPlayerCalendarItemRow,
  normalizePlayerCalendarKind,
} from '../player-calendar-items'

describe('player calendar items', () => {
  it('normalizes calendar item kind values', () => {
    expect(normalizePlayerCalendarKind('practice')).toBe('practice')
    expect(normalizePlayerCalendarKind('match')).toBe('match')
    expect(normalizePlayerCalendarKind('availability')).toBe('availability')
    expect(normalizePlayerCalendarKind('unknown')).toBe('reminder')
  })

  it('builds player-owned calendar payloads with validated dates and times', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('calendar-random')

    expect(
      buildPlayerCalendarItemPayload(
        {
          title: ' Serve reps ',
          date: '2026-06-12',
          time: '16:30',
          location: ' Court 4 ',
          kind: 'practice',
          recurrenceRule: 'weekly',
        },
        'player-1',
      ),
    ).toMatchObject({
      id: 'player-calendar-calendar-random',
      player_user_id: 'player-1',
      title: 'Serve reps',
      scheduled_date: '2026-06-12',
      scheduled_time: '16:30',
      location: 'Court 4',
      kind: 'practice',
      recurrence_rule: 'FREQ=WEEKLY',
      availability_status: '',
    })

    expect(buildPlayerCalendarItemPayload({ title: 'No date', date: 'soon' }, 'player-1')).toBeNull()
    expect(buildPlayerCalendarItemPayload({ title: 'Bad time', date: '2026-06-12', time: 'later' }, 'player-1')).toMatchObject({
      scheduled_time: '',
      kind: 'reminder',
    })
    expect(buildPlayerCalendarItemPayload({ title: 'Free hit', date: '2026-06-12', kind: 'availability' }, 'player-1')).toMatchObject({
      kind: 'availability',
      availability_status: 'available',
    })
  })

  it('maps database rows into My Lab calendar items', () => {
    expect(
      mapPlayerCalendarItemRow({
        id: 'item-1',
        player_user_id: 'player-1',
        title: 'Practice block',
        scheduled_date: '2026-06-12',
        scheduled_time: null,
        location: 'Indoor Court 2',
        kind: 'lesson',
        recurrence_rule: 'FREQ=MONTHLY',
        availability_status: '',
        created_at: '2026-06-10T12:00:00.000Z',
        updated_at: '2026-06-10T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'item-1',
      title: 'Practice block',
      date: '2026-06-12',
      time: '',
      location: 'Indoor Court 2',
      kind: 'lesson',
      recurrenceRule: 'FREQ=MONTHLY',
      availabilityStatus: '',
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-10T12:00:00.000Z',
    })
  })
})
