import { describe, expect, it, vi } from 'vitest'

const insertedNotifications: Array<Record<string, unknown>> = []
let savedResponse: Record<string, unknown> | null = null

const playerSupabase = {
  from(table: string) {
    if (table === 'player_schedule_responses') {
      return {
        upsert(payload: Record<string, unknown>) {
          savedResponse = payload
          return this
        },
        select() {
          return this
        },
        async single() {
          return {
            data: { id: 'response-1', ...(savedResponse ?? {}), updated_at: '2026-09-01T12:00:00.000Z' },
            error: null,
          }
        },
      }
    }

    if (table === 'internal_notifications') {
      return {
        async insert(payload: Record<string, unknown>) {
          insertedNotifications.push(payload)
          return { error: null }
        },
      }
    }

    const isLeague = table === 'tiq_leagues'
    return {
      select() {
        return this
      },
      eq() {
        return this
      },
      async maybeSingle() {
        return {
          data: isLeague ? { created_by_user_id: 'director-1' } : { player_name: 'Taylor Player' },
          error: null,
        }
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

vi.mock('@/lib/player-competition-schedule', () => ({
  loadPlayerCompetitionSchedule: vi.fn(async () => [{
    id: 'league:league-1:match-1',
    kind: 'league',
    eventType: 'match',
    competitionId: 'league-1',
    competitionName: 'Monday Singles',
    title: 'Monday Singles: vs Jordan Player',
    date: '2026-09-03',
    time: '19:00',
    location: 'Court 5',
    opponent: 'Jordan Player',
    detail: 'Week 2',
    href: '/explore/leagues/tiq/league-1',
    status: 'Confirmed',
  }]),
}))

describe('player competition schedule response route', () => {
  it('saves the current event snapshot and alerts the organizer', async () => {
    insertedNotifications.length = 0
    savedResponse = null
    const route = await import('../../app/api/player/competition-schedule-response/route')
    const response = await route.POST(new Request('https://tenaceiq.com/api/player/competition-schedule-response', {
      method: 'POST',
      body: JSON.stringify({ eventId: 'league:league-1:match-1', response: 'unavailable' }),
    }))
    const body = (await response.json()) as { ok?: boolean; item?: Record<string, unknown> }

    expect(response.status).toBe(200)
    expect(body.item).toMatchObject({
      eventId: 'league:league-1:match-1',
      response: 'unavailable',
    })
    expect(savedResponse).toMatchObject({
      player_user_id: 'player-1',
      competition_kind: 'league',
      competition_id: 'league-1',
      response: 'unavailable',
      event_snapshot: {
        date: '2026-09-03',
        time: '19:00',
        location: 'Court 5',
      },
    })
    expect(insertedNotifications).toEqual([expect.objectContaining({
      recipient_profile_id: 'director-1',
      actor_user_id: 'player-1',
      notification_type: 'schedule',
      title: 'Taylor Player can’t play',
    })])
  })
})
