import { describe, expect, it, vi } from 'vitest'

function resolvedQuery(data: unknown) {
  const query = {
    select() { return query },
    eq() { return query },
    in() { return query },
    gte() { return query },
    then(resolve: (value: { data: unknown; error: null }) => unknown) {
      return Promise.resolve({ data, error: null }).then(resolve)
    },
  }
  return query
}

const organizerSupabase = {
  from(table: string) {
    if (table === 'tiq_leagues') {
      return resolvedQuery([{
        id: 'league-1',
        league_name: 'Monday Singles',
        default_facility: 'Court 5',
        location_label: 'City Courts',
      }])
    }
    if (table === 'tiq_tournaments') return resolvedQuery([])
    if (table === 'tiq_league_schedule_items') {
      return resolvedQuery([{
        id: 'match-1',
        league_id: 'league-1',
        participant_a_name: 'Taylor Player',
        participant_b_name: 'Jordan Player',
        scheduled_date: '2099-09-03',
        scheduled_time: '19:00',
        facility: 'Court 5',
        status: 'confirmed',
      }])
    }
    if (table === 'tiq_player_league_entries') {
      return resolvedQuery([
        { league_id: 'league-1', player_name: 'Taylor Player', created_by_user_id: 'player-1' },
        { league_id: 'league-1', player_name: 'Jordan Player', created_by_user_id: 'player-2' },
      ])
    }
    if (table === 'player_schedule_responses') {
      return resolvedQuery([{
        competition_kind: 'league',
        competition_id: 'league-1',
        event_id: 'league:league-1:match-1',
        player_user_id: 'player-1',
        response: 'unavailable',
        event_snapshot: { date: '2099-09-03', time: '19:00', location: 'Court 5' },
      }])
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

describe('competition schedule attention route', () => {
  it('combines organizer-owned competitions into prioritized match attention', async () => {
    const route = await import('../../app/api/competition-schedule-attention/route')
    const response = await route.GET(new Request('https://tenaceiq.com/api/competition-schedule-attention'))
    const body = (await response.json()) as {
      ok?: boolean
      competitionCount?: number
      itemCount?: number
      items?: Array<Record<string, unknown>>
    }

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, competitionCount: 1, itemCount: 1 })
    expect(body.items?.[0]).toMatchObject({
      eventId: 'league:league-1:match-1',
      state: 'unavailable',
      unavailableCount: 1,
      waitingCount: 1,
      href: '/explore/leagues/tiq/league-1#league-schedule',
    })
  })
})
