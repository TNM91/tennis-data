import { describe, expect, it, vi } from 'vitest'

let insertedCalendarToken: Record<string, unknown> | null = null
let revokedCalendarTokenPayloads: Array<Record<string, unknown>> = []
let revokedCalendarTokenFilters: Array<[string, unknown]> = []

const playerSupabase = {
  from(table: string) {
    if (table === 'coach_player_links') {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        async maybeSingle() {
          return {
            data: {
              id: 'student-1',
              coach_user_id: 'coach-1',
              player_name: 'Taylor Player',
            },
            error: null,
          }
        },
      }
    }

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
  createCalendarFeedToken: () => 'player-private-token',
  hashCalendarFeedToken: (token: string) => `hash-${token}`,
}))

describe('player calendar link route', () => {
  it('creates a private subscribe URL only for the signed-in player coach link', async () => {
    insertedCalendarToken = null
    revokedCalendarTokenPayloads = []
    revokedCalendarTokenFilters = []
    const route = await import('../../app/api/player/calendar-links/route')
    const response = await route.POST(new Request('https://tenaceiq.com/api/player/calendar-links', {
      method: 'POST',
      body: JSON.stringify({ studentLinkId: 'student-1' }),
    }))
    const body = (await response.json()) as { ok?: boolean; calendarUrl?: string; playerName?: string }

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      calendarUrl: 'https://tenaceiq.com/api/calendar/coach-student/student-1/calendar.ics?token=player-private-token',
      playerName: 'Taylor Player',
    })
    expect(insertedCalendarToken).toMatchObject({
      token_hash: 'hash-player-private-token',
      scope_type: 'coach_student',
      scope_id: 'student-1',
      owner_user_id: 'player-1',
      viewer_user_id: 'coach-1',
      status: 'active',
    })
    expect(insertedCalendarToken).not.toHaveProperty('token', 'player-private-token')
    expect(revokedCalendarTokenPayloads[0]).toMatchObject({ status: 'revoked' })
    expect(revokedCalendarTokenFilters).toEqual([
      ['scope_type', 'coach_student'],
      ['scope_id', 'student-1'],
      ['owner_user_id', 'player-1'],
      ['status', 'active'],
    ])
  })

  it('revokes active player-owned calendar feeds for a coach link', async () => {
    insertedCalendarToken = null
    revokedCalendarTokenPayloads = []
    revokedCalendarTokenFilters = []
    const route = await import('../../app/api/player/calendar-links/route')
    const response = await route.DELETE(new Request('https://tenaceiq.com/api/player/calendar-links?studentLinkId=student-1', {
      method: 'DELETE',
    }))
    const body = (await response.json()) as { ok?: boolean }

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(insertedCalendarToken).toBeNull()
    expect(revokedCalendarTokenPayloads[0]).toMatchObject({ status: 'revoked' })
    expect(revokedCalendarTokenFilters).toEqual([
      ['scope_type', 'coach_student'],
      ['scope_id', 'student-1'],
      ['owner_user_id', 'player-1'],
      ['status', 'active'],
    ])
  })
})
