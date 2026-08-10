import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertedNotifications: Array<Record<string, unknown>> = []
let responseRows: Array<Record<string, unknown>> = []

function resolvedQuery(data: unknown) {
  const query = {
    select() {
      return query
    },
    eq() {
      return query
    },
    maybeSingle: async () => ({ data, error: null }),
    then(resolve: (value: { data: unknown; error: null }) => unknown) {
      return Promise.resolve({ data, error: null }).then(resolve)
    },
  }
  return query
}

const organizerSupabase = {
  from(table: string) {
    if (table === 'tiq_leagues') {
      return resolvedQuery({ created_by_user_id: 'organizer-1', league_name: 'Monday Singles' })
    }
    if (table === 'tiq_league_schedule_items') {
      return resolvedQuery({
        participant_a_name: 'Taylor Player',
        participant_b_name: 'Jordan Player',
        scheduled_date: '2026-09-03',
        scheduled_time: '19:00',
        facility: 'Court 5',
        status: 'confirmed',
      })
    }
    if (table === 'tiq_player_league_entries') {
      return resolvedQuery([
        { player_name: 'Taylor Player', created_by_user_id: 'player-1' },
        { player_name: 'Jordan Player', created_by_user_id: 'player-2' },
      ])
    }
    if (table === 'player_schedule_responses') {
      return resolvedQuery(responseRows)
    }
    if (table === 'internal_notifications') {
      return {
        async insert(payload: Array<Record<string, unknown>>) {
          insertedNotifications.push(...payload)
          return { error: null }
        },
      }
    }
    throw new Error(`Unexpected table ${table}`)
  },
}

vi.mock('@/lib/player-api-auth', () => ({
  getSignedInPlayerApiAuth: vi.fn(async () => ({
    ok: true,
    supabase: organizerSupabase,
    userId: 'organizer-1',
  })),
}))

describe('competition schedule reminder route', () => {
  beforeEach(() => {
    insertedNotifications.length = 0
    responseRows = []
  })

  it('reminds linked players who have not replied to the current match', async () => {
    responseRows = [{
      player_user_id: 'player-1',
      response: 'available',
      event_snapshot: { date: '2026-09-03', time: '19:00', location: 'Court 5' },
    }]
    const route = await import('../../app/api/competition-schedule-reminders/route')
    const response = await route.POST(new Request('https://tenaceiq.com/api/competition-schedule-reminders', {
      method: 'POST',
      body: JSON.stringify({
        competitionKind: 'league',
        competitionId: 'league-1',
        eventId: 'league:league-1:match-1',
        expectedPlayerNames: ['Taylor Player', 'Jordan Player'],
      }),
    }))
    const body = (await response.json()) as { ok?: boolean; sentCount?: number }

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, sentCount: 1 })
    expect(insertedNotifications).toEqual([expect.objectContaining({
      recipient_profile_id: 'player-2',
      actor_user_id: 'organizer-1',
      notification_type: 'schedule',
      title: 'Please confirm your availability',
      href: '/compete/schedule#event-league%3Aleague-1%3Amatch-1',
    })])
  })

  it('asks again when a saved reply belongs to an earlier time', async () => {
    responseRows = [
      {
        player_user_id: 'player-1',
        response: 'available',
        event_snapshot: { date: '2026-09-02', time: '19:00', location: 'Court 5' },
      },
      {
        player_user_id: 'player-2',
        response: 'unavailable',
        event_snapshot: { date: '2026-09-03', time: '19:00', location: 'Court 5' },
      },
    ]
    const route = await import('../../app/api/competition-schedule-reminders/route')
    const response = await route.POST(new Request('https://tenaceiq.com/api/competition-schedule-reminders', {
      method: 'POST',
      body: JSON.stringify({
        competitionKind: 'league',
        competitionId: 'league-1',
        eventId: 'league:league-1:match-1',
        expectedPlayerNames: ['Taylor Player', 'Jordan Player'],
      }),
    }))

    expect(response.status).toBe(200)
    expect(insertedNotifications.map((item) => item.recipient_profile_id)).toEqual(['player-1'])
  })
})
