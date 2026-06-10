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
          kind: 'practice',
        },
        'player-1',
      ),
    ).toMatchObject({
      id: 'player-calendar-calendar-random',
      player_user_id: 'player-1',
      title: 'Serve reps',
      scheduled_date: '2026-06-12',
      scheduled_time: '16:30',
      kind: 'practice',
    })

    expect(buildPlayerCalendarItemPayload({ title: 'No date', date: 'soon' }, 'player-1')).toBeNull()
    expect(buildPlayerCalendarItemPayload({ title: 'Bad time', date: '2026-06-12', time: 'later' }, 'player-1')).toMatchObject({
      scheduled_time: '',
      kind: 'reminder',
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
        kind: 'lesson',
        created_at: '2026-06-10T12:00:00.000Z',
        updated_at: '2026-06-10T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'item-1',
      title: 'Practice block',
      date: '2026-06-12',
      time: '',
      kind: 'lesson',
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-10T12:00:00.000Z',
    })
  })
})
