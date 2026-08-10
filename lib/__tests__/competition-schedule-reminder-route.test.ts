import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertedNotifications: Array<Record<string, unknown>> = []
const insertedReminderHistory: Array<Record<string, unknown>> = []
let responseRows: Array<Record<string, unknown>> = []
let reminderHistoryRows: Array<Record<string, unknown>> = []

function resolvedQuery(data: unknown) {
  const query = {
    select() {
      return query
    },
    eq() {
      return query
    },
    in() {
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
    if (table === 'competition_schedule_reminders') {
      return {
        select() {
          return resolvedQuery(reminderHistoryRows)
        },
        async insert(payload: Array<Record<string, unknown>>) {
          insertedReminderHistory.push(...payload)
          return { error: null }
        },
      }
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
    insertedReminderHistory.length = 0
    responseRows = []
    reminderHistoryRows = []
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
    expect(insertedReminderHistory).toEqual([expect.objectContaining({
      player_user_id: 'player-2',
      event_id: 'league:league-1:match-1',
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

  it('does not resend the same schedule reminder within 24 hours', async () => {
    responseRows = [{
      player_user_id: 'player-1',
      response: 'available',
      event_snapshot: { date: '2026-09-03', time: '19:00', location: 'Court 5' },
    }]
    reminderHistoryRows = [{
      event_id: 'league:league-1:match-1',
      player_user_id: 'player-2',
      event_snapshot: { date: '2026-09-03', time: '19:00', location: 'Court 5' },
      sent_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
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
    const body = (await response.json()) as { sentCount?: number; cooldownCount?: number }

    expect(body).toMatchObject({ sentCount: 0, cooldownCount: 1 })
    expect(insertedNotifications).toEqual([])
    expect(insertedReminderHistory).toEqual([])
  })
})
