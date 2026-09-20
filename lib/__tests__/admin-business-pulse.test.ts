import { describe, expect, it } from 'vitest'
import { buildBusinessPulse } from '../admin-business-pulse'

describe('buildBusinessPulse', () => {
  it('estimates monthly recurring value from active Stripe-managed monthly plans', () => {
    const pulse = buildBusinessPulse({
      profiles: [
        {
          role: 'member',
          stripe_customer_id: 'cus_player',
          player_plus_subscription_active: true,
          player_plus_subscription_status: 'active',
        },
        {
          role: 'captain',
          stripe_subscription_id: 'sub_captain',
          captain_subscription_active: true,
          captain_subscription_status: 'active',
        },
        {
          role: 'member',
          coach_subscription_active: true,
          coach_subscription_status: 'trial',
        },
        {
          role: 'member',
          stripe_subscription_id: 'sub_league',
          tiq_team_league_entry_enabled: true,
        },
      ],
      clubs: [
        { plan_id: 'club_starter', status: 'active', stripe_subscription_id: 'sub_club_1' },
        { plan_id: 'club_unlimited', status: 'active', stripe_subscription_id: 'sub_club_2' },
        { plan_id: 'club_unlimited', status: 'canceled', stripe_subscription_id: 'sub_club_3' },
      ],
      events: [],
      now: Date.parse('2026-09-20T12:00:00Z'),
    })

    expect(pulse.estimatedMrrCents).toBe(25_498)
    expect(pulse.activePaidSubscriptions).toBe(4)
  })

  it('counts first paid activations and cancellations in 30 days and converts recorded trials', () => {
    const now = Date.parse('2026-09-20T12:00:00Z')
    const pulse = buildBusinessPulse({
      profiles: [
        { id: 'profile-new', role: 'member', linked_player_name: 'Taylor Ace' },
        { id: 'profile-old', role: 'member', message_display_name: 'Jordan Serve' },
      ],
      clubs: [],
      events: [
        { stripe_event_id: 'evt_trial', profile_id: 'profile-new', stripe_subscription_id: 'sub_new', outcome: 'handled', resulting_status: 'trial', created_at: '2026-09-01T12:00:00Z' },
        { stripe_event_id: 'evt_active', profile_id: 'profile-new', stripe_subscription_id: 'sub_new', plan_id: 'captain', outcome: 'handled', resulting_status: 'active', created_at: '2026-09-04T12:00:00Z' },
        { stripe_event_id: 'evt_repeat', profile_id: 'profile-new', stripe_subscription_id: 'sub_new', outcome: 'handled', resulting_status: 'active', created_at: '2026-09-10T12:00:00Z' },
        { stripe_event_id: 'evt_old', profile_id: 'profile-old', stripe_subscription_id: 'sub_old', plan_id: 'player_plus', outcome: 'handled', resulting_status: 'active', created_at: '2026-07-01T12:00:00Z' },
        { stripe_event_id: 'evt_cancel', profile_id: 'profile-old', stripe_subscription_id: 'sub_old', plan_id: 'player_plus', event_type: 'customer.subscription.deleted', outcome: 'handled', resulting_status: 'canceled', created_at: '2026-09-15T12:00:00Z' },
        { stripe_event_id: 'evt_failed', stripe_subscription_id: 'sub_failed', outcome: 'failed', resulting_status: 'active', created_at: '2026-09-15T12:00:00Z' },
      ],
      now,
    })

    expect(pulse.newPaidAccounts30d).toBe(1)
    expect(pulse.cancellations30d).toBe(1)
    expect(pulse.recordedTrials).toBe(1)
    expect(pulse.trialConversions).toBe(1)
    expect(pulse.trialConversionRate).toBe(1)
    expect(pulse.subscriptionTrend6m).toEqual([
      { month: '2026-04', label: 'Apr', newPaidAccounts: 0, cancellations: 0, movements: [] },
      { month: '2026-05', label: 'May', newPaidAccounts: 0, cancellations: 0, movements: [] },
      { month: '2026-06', label: 'Jun', newPaidAccounts: 0, cancellations: 0, movements: [] },
      {
        month: '2026-07', label: 'Jul', newPaidAccounts: 1, cancellations: 0,
        movements: [{ kind: 'new_paid', occurredAt: '2026-07-01T12:00:00.000Z', accountLabel: 'Jordan Serve', profileId: 'profile-old', subscriptionId: 'sub_old', planLabel: 'Player' }],
      },
      { month: '2026-08', label: 'Aug', newPaidAccounts: 0, cancellations: 0, movements: [] },
      {
        month: '2026-09', label: 'Sep', newPaidAccounts: 1, cancellations: 1,
        movements: [
          { kind: 'canceled', occurredAt: '2026-09-15T12:00:00.000Z', accountLabel: 'Jordan Serve', profileId: 'profile-old', subscriptionId: 'sub_old', planLabel: 'Player' },
          { kind: 'new_paid', occurredAt: '2026-09-04T12:00:00.000Z', accountLabel: 'Taylor Ace', profileId: 'profile-new', subscriptionId: 'sub_new', planLabel: 'Captain' },
        ],
      },
    ])
  })
})
