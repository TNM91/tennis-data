import { describe, expect, it } from 'vitest'
import { countAccountTiers, summarizeAccountTiers } from '../admin-account-tiers'

describe('countAccountTiers', () => {
  it('counts each profile once by effective access and separates admins', () => {
    const counts = countAccountTiers([
      { role: 'member' },
      { role: 'member', player_plus_subscription_active: true },
      { role: 'member', coach_subscription_active: true },
      { role: 'captain', captain_subscription_active: true },
      { role: 'member', tiq_team_league_entry_enabled: true },
      { role: 'member', player_plus_subscription_active: true, captain_subscription_active: true, tiq_individual_league_creator_enabled: true },
      { role: 'admin' },
    ])

    expect(counts).toEqual({ total: 7, admins: 1, free: 1, player_plus: 1, coach: 1, captain: 1, league: 1, full_court: 1 })
  })

  it('does not count an expired grant as an active tier', () => {
    const counts = countAccountTiers([
      { role: 'member', captain_subscription_active: true, captain_access_expires_at: '2020-01-01T00:00:00Z' },
    ])
    expect(counts.free).toBe(1)
    expect(counts.captain).toBe(0)
  })

  it('separates paid, trial, complimentary, past-due, and expiring access by tier', () => {
    const now = Date.parse('2026-09-20T12:00:00Z')
    const summary = summarizeAccountTiers([
      {
        role: 'member',
        stripe_customer_id: 'cus_paid',
        player_plus_subscription_active: true,
        player_plus_subscription_status: 'active',
      },
      {
        role: 'member',
        coach_subscription_active: true,
        coach_subscription_status: 'trial',
        coach_access_expires_at: '2026-09-27T12:00:00Z',
      },
      {
        role: 'captain',
        captain_subscription_active: true,
        captain_subscription_status: 'active',
      },
      {
        role: 'member',
        stripe_subscription_id: 'sub_past_due',
        player_plus_subscription_status: 'past_due',
      },
      { role: 'member' },
      { role: 'admin', captain_subscription_active: true },
    ], now)

    expect(summary.healthByTier.player_plus.paid).toBe(1)
    expect(summary.healthByTier.coach.trial).toBe(1)
    expect(summary.healthByTier.coach.expiring).toBe(1)
    expect(summary.healthByTier.captain.complimentary).toBe(1)
    expect(summary.healthByTier.free.pastDue).toBe(1)
    expect(summary.healthTotals).toEqual({ paid: 1, trial: 1, complimentary: 1, pastDue: 1, expiring: 1 })
    expect(summary.healthByTier.free).toEqual({ paid: 0, trial: 0, complimentary: 0, pastDue: 1, expiring: 0 })
  })
})
