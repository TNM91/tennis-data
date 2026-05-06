import { describe, expect, it } from 'vitest'

import { buildProfileActivationPayload, resolveUpgradeActivationTarget } from '../upgrade-activation'

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

describe('resolveUpgradeActivationTarget', () => {
  it('uses the stored request plan and user as the activation target', () => {
    expect(resolveUpgradeActivationTarget({
      id: 'request-1',
      planId: 'captain',
      userId: 'user-1',
      status: 'pending',
    })).toEqual({
      ok: true,
      requestId: 'request-1',
      planId: 'captain',
      userId: 'user-1',
    })
  })

  it('rejects requests without linked accounts', () => {
    expect(resolveUpgradeActivationTarget({
      id: 'request-1',
      planId: 'player_plus',
      userId: null,
      status: 'pending',
    })).toEqual({
      ok: false,
      status: 400,
      message: 'This request is not linked to an account yet.',
    })
  })

  it('rejects invalid stored plans before activation', () => {
    expect(resolveUpgradeActivationTarget({
      id: 'request-1',
      planId: 'free',
      userId: 'user-1',
      status: 'pending',
    })).toEqual({
      ok: false,
      status: 400,
      message: 'This plan cannot be activated from the request queue.',
    })
  })

  it('does not reactivate converted or closed requests', () => {
    expect(resolveUpgradeActivationTarget({
      id: 'request-1',
      planId: 'captain',
      userId: 'user-1',
      status: 'converted',
    })).toEqual({
      ok: false,
      status: 409,
      message: 'This request has already been activated.',
    })

    expect(resolveUpgradeActivationTarget({
      id: 'request-2',
      planId: 'captain',
      userId: 'user-1',
      status: 'closed',
    })).toEqual({
      ok: false,
      status: 409,
      message: 'This request is closed.',
    })
  })
})
