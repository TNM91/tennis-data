import { describe, expect, it, vi } from 'vitest'

let upsertedCalendarItem: Record<string, unknown> | null = null
let deletedCalendarItemFilters: Array<[string, unknown]> = []

const calendarRows = [
  {
    id: 'item-1',
    player_user_id: 'player-1',
    title: 'Serve reps',
    scheduled_date: '2026-06-12',
    scheduled_time: '16:30',
    location: 'Court 4',
    kind: 'practice',
    recurrence_rule: 'FREQ=WEEKLY',
    availability_status: '',
    created_at: '2026-06-10T12:00:00.000Z',
    updated_at: '2026-06-10T12:00:00.000Z',
  },
]

const playerSupabase = {
  from(table: string) {
    expect(table).toBe('player_calendar_items')
    return {
      select() {
        return this
      },
      eq(field: string, value: unknown) {
        deletedCalendarItemFilters.push([field, value])
        return this
      },
      order() {
        return this
      },
      limit() {
        return this
      },
      upsert(payload: Record<string, unknown>) {
        upsertedCalendarItem = payload
        return this
      },
      delete() {
        return this
      },
      async single() {
        return {
          data: {
            ...calendarRows[0],
            ...(upsertedCalendarItem ?? {}),
            created_at: '2026-06-10T12:00:00.000Z',
          },
          error: null,
        }
      },
      then(resolve: (value: { data?: typeof calendarRows; error: null }) => void) {
        resolve({ data: calendarRows, error: null })
      },
    }
  },
}

vi.mock('@/lib/player-api-auth', () => ({
  getSignedInPlayerApiAuth: vi.fn(async () => ({
    ok: true,
    supabase: playerSupabase,
    userId: 'player-1',
  })),
}))

vi.mock('@/lib/player-calendar-items', async () => {
  return await import('../player-calendar-items')
})

describe('player calendar items route', () => {
  it('lists signed-in player calendar items', async () => {
    deletedCalendarItemFilters = []
    const route = await import('../../app/api/player/calendar-items/route')
    const response = await route.GET(new Request('https://tenaceiq.com/api/player/calendar-items'))
    const body = (await response.json()) as { ok?: boolean; items?: Array<Record<string, unknown>> }

    expect(response.status).toBe(200)
    expect(body.items?.[0]).toMatchObject({
      id: 'item-1',
      title: 'Serve reps',
      date: '2026-06-12',
      time: '16:30',
      kind: 'practice',
    })
  })

  it('saves signed-in player calendar items', async () => {
    upsertedCalendarItem = null
    const route = await import('../../app/api/player/calendar-items/route')
    const response = await route.POST(new Request('https://tenaceiq.com/api/player/calendar-items', {
      method: 'POST',
      body: JSON.stringify({
        item: {
          id: 'item-2',
          title: 'Return practice',
          date: '2026-06-13',
          time: '09:00',
          location: 'Indoor Court 2',
          kind: 'practice',
          recurrenceRule: 'weekly',
        },
      }),
    }))
    const body = (await response.json()) as { ok?: boolean; item?: Record<string, unknown> }

    expect(response.status).toBe(200)
    expect(upsertedCalendarItem).toMatchObject({
      id: 'item-2',
      player_user_id: 'player-1',
      title: 'Return practice',
      scheduled_date: '2026-06-13',
      scheduled_time: '09:00',
      location: 'Indoor Court 2',
      kind: 'practice',
      recurrence_rule: 'FREQ=WEEKLY',
      availability_status: '',
    })
    expect(body.item).toMatchObject({
      id: 'item-2',
      title: 'Return practice',
      date: '2026-06-13',
      location: 'Indoor Court 2',
      recurrenceRule: 'FREQ=WEEKLY',
    })
  })

  it('deletes only the signed-in player calendar item', async () => {
    deletedCalendarItemFilters = []
    const route = await import('../../app/api/player/calendar-items/route')
    const response = await route.DELETE(new Request('https://tenaceiq.com/api/player/calendar-items?id=item-1', {
      method: 'DELETE',
    }))
    const body = (await response.json()) as { ok?: boolean }

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(deletedCalendarItemFilters).toEqual([
      ['id', 'item-1'],
      ['player_user_id', 'player-1'],
    ])
  })
})
