import { describe, expect, it, vi } from 'vitest'

let insertedCalendarToken: Record<string, unknown> | null = null
let revokedCalendarTokenPayloads: Array<Record<string, unknown>> = []
let revokedCalendarTokenFilters: Array<[string, unknown]> = []

const playerSupabase = {
  from(table: string) {
    expect(table).toBe('calendar_feed_tokens')
    return {
      update(payload: Record<string, unknown>) {
        revokedCalendarTokenPayloads.push(payload)
        return this
      },
      eq(field: string, value: unknown) {
        revokedCalendarTokenFilters.push([field, value])
        return this
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
    expect(revokedCalendarTokenFilters).toEqual([
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
    expect(revokedCalendarTokenFilters).toEqual([
      ['scope_type', 'player_calendar'],
      ['scope_id', 'player-1'],
      ['owner_user_id', 'player-1'],
      ['status', 'active'],
    ])
  })
})
