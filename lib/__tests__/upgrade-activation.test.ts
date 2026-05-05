import { describe, expect, it } from 'vitest'

import { buildProfileActivationPayload } from '../upgrade-activation'

describe('buildProfileActivationPayload', () => {
  it('activates Player without Captain or Coordinator entitlements', () => {
    expect(buildProfileActivationPayload('player_plus')).toEqual({
      player_plus_subscription_active: true,
      player_plus_subscription_status: 'active',
    })
  })

  it('activates Captain with Player access included', () => {
    expect(buildProfileActivationPayload('captain')).toEqual({
      player_plus_subscription_active: true,
      player_plus_subscription_status: 'active',
      captain_subscription_active: true,
      captain_subscription_status: 'active',
    })
  })

  it('activates Coordinator without granting Player or Captain access', () => {
    expect(buildProfileActivationPayload('league')).toEqual({
      tiq_team_league_entry_enabled: true,
      tiq_individual_league_creator_enabled: true,
    })
  })
})
