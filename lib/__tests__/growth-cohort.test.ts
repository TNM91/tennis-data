import { describe, expect, it } from 'vitest'
import { buildGrowthCohort } from '@/lib/growth-cohort'

describe('growth cohort', () => {
  it('counts only ordered actions by members in the signup cohort', () => {
    const events = [
      { user_id: 'a', event_name: 'search_result_clicked', created_at: '2026-09-01T09:00:00Z' },
      { user_id: 'a', event_name: 'signup_confirmation_sent', created_at: '2026-09-01T10:00:00Z' },
      { user_id: 'a', event_name: 'search_result_clicked', created_at: '2026-09-01T11:00:00Z' },
      { user_id: 'a', event_name: 'upgrade_checkout_started', created_at: '2026-09-02T10:00:00Z' },
      { user_id: 'b', event_name: 'signup_confirmation_sent', created_at: '2026-09-03T10:00:00Z' },
      { user_id: 'b', event_name: 'mylab_goal_template_applied', created_at: '2026-09-03T11:00:00Z' },
      { user_id: 'c', event_name: 'upgrade_checkout_started', created_at: '2026-09-04T10:00:00Z' },
    ]
    const billing = [
      { profile_id: 'a', outcome: 'handled', resulting_status: 'active', created_at: '2026-09-01T12:00:00Z' },
      { profile_id: 'a', outcome: 'handled', resulting_status: 'active', created_at: '2026-09-02T11:00:00Z' },
      { profile_id: 'c', outcome: 'handled', resulting_status: 'active', created_at: '2026-09-04T11:00:00Z' },
    ]

    expect(buildGrowthCohort(events, billing)).toEqual({
      publicActions: 3,
      signupRequests: 2,
      firstActions: 2,
      checkoutStarts: 1,
      paidActivations: 1,
    })
  })

  it('counts a completed follow as a first useful action after signup', () => {
    expect(buildGrowthCohort([
      { user_id: 'new-player', event_name: 'signup_confirmation_sent', created_at: '2026-09-21T10:00:00Z' },
      { user_id: 'new-player', event_name: 'follow_upgrade_clicked', created_at: '2026-09-21T10:02:00Z' },
      { user_id: 'new-player', event_name: 'follow_intent_completed', created_at: '2026-09-21T10:20:00Z' },
    ], [])).toMatchObject({ signupRequests: 1, firstActions: 1 })
  })
})
