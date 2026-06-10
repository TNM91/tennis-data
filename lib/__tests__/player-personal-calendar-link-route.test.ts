import { describe, expect, it, vi } from 'vitest'

let insertedCalendarToken: Record<string, unknown> | null = null
let revokedCalendarTokenPayloads: Array<Record<string, unknown>> = []
let revokedCalendarTokenFilters: Array<[string, unknown]> = []
let selectedCalendarTokenFilters: Array<[string, unknown]> = []

const playerSupabase = {
  from(table: string) {
    expect(table).toBe('calendar_feed_tokens')
    return {
      select() {
        return this
      },
      update(payload: Record<string, unknown>) {
        revokedCalendarTokenPayloads.push(payload)
        return this
      },
      eq(field: string, value: unknown) {
        selectedCalendarTokenFilters.push([field, value])
        revokedCalendarTokenFilters.push([field, value])
        return this
      },
      order() {
        return this
      },
      limit() {
        return this
      },
      async maybeSingle() {
        return {
          data: {
            id: 'token-1',
            created_at: '2026-06-10T15:00:00.000Z',
            last_used_at: '2026-06-10T15:30:00.000Z',
            updated_at: '2026-06-10T15:00:00.000Z',
          },
          error: null,
        }
      },
      then(resolve: (value: { error: null }) => void) {
        resolve({ error: null })
      },
      async insert(payload: Record<string, unknown>) {
        insertedCalendarToken = payload
        return { error: null }
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

vi.mock('@/lib/calendar-feed-tokens', () => ({
  createCalendarFeedToken: () => 'player-calendar-token',
  hashCalendarFeedToken: (token: string) => `hash-${token}`,
}))

describe('player personal calendar link route', () => {
  it('reports active My Calendar feed status without exposing the token', async () => {
    selectedCalendarTokenFilters = []

    const route = await import('../../app/api/player/personal-calendar-link/route')
    const response = await route.GET(new Request('https://tenaceiq.com/api/player/personal-calendar-link'))
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      active: true,
      createdAt: '2026-06-10T15:00:00.000Z',
      lastUsedAt: '2026-06-10T15:30:00.000Z',
      updatedAt: '2026-06-10T15:00:00.000Z',
    })
    expect(body).not.toHaveProperty('calendarUrl')
    expect(body).not.toHaveProperty('token')
    expect(selectedCalendarTokenFilters).toEqual([
      ['scope_type', 'player_calendar'],
      ['scope_id', 'player-1'],
      ['owner_user_id', 'player-1'],
      ['status', 'active'],
    ])
  })

  it('creates a private My Calendar subscribe URL for the signed-in player', async () => {
    insertedCalendarToken = null
    revokedCalendarTokenPayloads = []
    revokedCalendarTokenFilters = []

    const route = await import('../../app/api/player/personal-calendar-link/route')
    const response = await route.POST(new Request('https://tenaceiq.com/api/player/personal-calendar-link', {
      method: 'POST',
    }))
    const body = (await response.json()) as { ok?: boolean; calendarUrl?: string }

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      calendarUrl: 'https://tenaceiq.com/api/calendar/player/player-1/calendar.ics?token=player-calendar-token',
    })
    expect(insertedCalendarToken).toMatchObject({
      token_hash: 'hash-player-calendar-token',
      scope_type: 'player_calendar',
      scope_id: 'player-1',
      owner_user_id: 'player-1',
      viewer_user_id: null,
      status: 'active',
    })
    expect(insertedCalendarToken).not.toHaveProperty('token', 'player-calendar-token')
    expect(revokedCalendarTokenPayloads[0]).toMatchObject({ status: 'revoked' })
    expect(revokedCalendarTokenFilters.slice(-4)).toEqual([
      ['scope_type', 'player_calendar'],
      ['scope_id', 'player-1'],
      ['owner_user_id', 'player-1'],
      ['status', 'active'],
    ])
  })

  it('revokes active player-owned My Calendar feeds', async () => {
    insertedCalendarToken = null
    revokedCalendarTokenPayloads = []
    revokedCalendarTokenFilters = []

    const route = await import('../../app/api/player/personal-calendar-link/route')
    const response = await route.DELETE(new Request('https://tenaceiq.com/api/player/personal-calendar-link', {
      method: 'DELETE',
    }))
    const body = (await response.json()) as { ok?: boolean }

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(insertedCalendarToken).toBeNull()
    expect(revokedCalendarTokenPayloads[0]).toMatchObject({ status: 'revoked' })
    expect(revokedCalendarTokenFilters.slice(-4)).toEqual([
      ['scope_type', 'player_calendar'],
      ['scope_id', 'player-1'],
      ['owner_user_id', 'player-1'],
      ['status', 'active'],
    ])
  })
})
