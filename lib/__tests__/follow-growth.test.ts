import { describe, expect, it } from 'vitest'
import { buildFollowGrowthCohort } from '../follow-growth'

describe('follow upgrade journey', () => {
  it('counts distinct signed-in people and only their ordered Player checkout and follow events', () => {
    const events = [
      { user_id: 'a', event_name: 'follow_upgrade_clicked', created_at: '2026-09-21T10:00:00Z' },
      { user_id: 'a', event_name: 'follow_upgrade_clicked', created_at: '2026-09-21T10:05:00Z' },
      { user_id: 'a', event_name: 'upgrade_checkout_started', plan_id: 'player_plus', created_at: '2026-09-21T10:10:00Z' },
      { user_id: 'a', event_name: 'follow_intent_completed', created_at: '2026-09-21T10:15:00Z' },
      { user_id: 'b', event_name: 'follow_upgrade_clicked', created_at: '2026-09-21T11:00:00Z' },
      { user_id: 'b', event_name: 'upgrade_checkout_started', plan_id: 'captain', created_at: '2026-09-21T11:10:00Z' },
      { user_id: 'c', event_name: 'follow_upgrade_clicked', created_at: '2026-09-21T12:00:00Z' },
      { user_id: 'c', event_name: 'upgrade_checkout_started', plan_id: 'player_plus', created_at: '2026-09-21T13:01:00Z' },
      { user_id: 'd', event_name: 'follow_intent_completed', created_at: '2026-09-21T12:20:00Z' },
      { user_id: null, event_name: 'follow_upgrade_clicked', created_at: '2026-09-21T12:30:00Z' },
    ]

    const requests = [
      { requester_user_id: 'a', plan_id: 'player_plus', next_href: '/players/alex', created_at: '2026-09-21T10:08:00Z' },
      { requester_user_id: 'a', plan_id: 'player_plus', next_href: '/players/alex', created_at: '2026-09-21T10:09:00Z' },
      { requester_user_id: 'b', plan_id: 'captain', next_href: '/teams/team-a', created_at: '2026-09-21T11:05:00Z' },
      { requester_user_id: 'c', plan_id: 'player_plus', next_href: '/leagues/league-a', created_at: '2026-09-21T13:01:00Z' },
      { requester_user_id: null, plan_id: 'player_plus', next_href: '/players/alex', created_at: '2026-09-21T10:03:00Z' },
    ]

    expect(buildFollowGrowthCohort(events, requests)).toEqual({
      intentClicks: 3,
      playerRequests: 1,
      playerCheckoutStarts: 1,
      completedFollows: 1,
    })
  })

  it('counts a public request linked after sign-in without counting unrelated or old requests', () => {
    const events = [{ user_id: 'a', event_name: 'follow_upgrade_clicked', created_at: '2026-09-21T10:00:00Z' }]
    const requests = [
      { requester_user_id: 'a', plan_id: 'player_plus', next_href: '/players', created_at: '2026-09-21T10:01:00Z' },
      { requester_user_id: 'a', plan_id: 'player_plus', next_href: '/players/alex', created_at: '2026-09-21T08:59:00Z' },
      { requester_user_id: 'a', plan_id: 'player_plus', next_href: '/upgrade?next=/players/alex', created_at: '2026-09-21T10:02:00Z' },
    ]

    expect(buildFollowGrowthCohort(events, requests).playerRequests).toBe(0)
    expect(buildFollowGrowthCohort(events, [
      ...requests,
      { requester_user_id: 'a', plan_id: 'player_plus', next_href: '/players/alex', created_at: '2026-09-21T09:59:00Z' },
    ]).playerRequests).toBe(1)
  })
})
