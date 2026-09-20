import { describe, expect, it } from 'vitest'
import { countAccountTiers } from '../admin-account-tiers'

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
})
