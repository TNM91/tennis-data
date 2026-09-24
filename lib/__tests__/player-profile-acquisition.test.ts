import { describe, expect, it } from 'vitest'
import { getPlayerProfileAcquisitionSource, PLAYER_PROFILE_SHARE_SOURCE, PLAYER_PROFILE_SOURCE } from '@/lib/player-profile-acquisition'
import { buildPlayerProfileAcquisitionFunnel, getPlayerProfileSignupIds } from '@/lib/player-profile-growth-funnel'
import type { GrowthEventRow } from '@/lib/admin-growth-funnel'
import type { ScorecardSignupProfile } from '@/lib/scorecard-growth-funnel'

const signup = (id: string, source: string): GrowthEventRow => ({
  user_id: id,
  event_name: 'signup_confirmation_sent',
  plan_id: null,
  metadata: { acquisitionSource: source },
})

const profile = (id: string, linkedPlayerId: string | null): ScorecardSignupProfile => ({
  id,
  linked_player_id: linkedPlayerId,
  stripe_subscription_id: null,
  player_plus_subscription_active: false,
  player_plus_subscription_status: null,
  player_plus_access_expires_at: null,
})

describe('player profile acquisition', () => {
  it('accepts only profile connection sources for the Free player setup path', () => {
    expect(getPlayerProfileAcquisitionSource(PLAYER_PROFILE_SOURCE, 'free', '/profile#profile-identity')).toBe(PLAYER_PROFILE_SOURCE)
    expect(getPlayerProfileAcquisitionSource(PLAYER_PROFILE_SHARE_SOURCE, 'free', '/profile#profile-identity')).toBe(PLAYER_PROFILE_SHARE_SOURCE)
    expect(getPlayerProfileAcquisitionSource(PLAYER_PROFILE_SOURCE, 'captain', '/profile#profile-identity')).toBeNull()
    expect(getPlayerProfileAcquisitionSource(PLAYER_PROFILE_SOURCE, 'free', '/explore')).toBeNull()
    expect(getPlayerProfileAcquisitionSource('scorecard_share', 'free', '/profile#profile-identity')).toBeNull()
  })

  it('counts distinct signup accounts and their confirmed player connections by source', () => {
    const events = [
      signup('public-a', PLAYER_PROFILE_SOURCE),
      signup('public-a', PLAYER_PROFILE_SOURCE),
      signup('public-b', PLAYER_PROFILE_SOURCE),
      signup('shared-a', PLAYER_PROFILE_SHARE_SOURCE),
      signup('other', 'scorecard_share'),
      { ...signup('not-a-signup', PLAYER_PROFILE_SOURCE), event_name: 'profile_player_linked' },
    ]
    const identities = [
      { id: 'public-a', emailConfirmed: true },
      { id: 'public-b', emailConfirmed: false },
      { id: 'shared-a', emailConfirmed: true },
    ]
    const profiles = [
      profile('public-a', 'player-a'),
      profile('public-b', 'player-b'),
      profile('shared-a', null),
    ]

    expect(getPlayerProfileSignupIds(events)).toEqual(['public-a', 'public-b', 'shared-a'])
    expect(buildPlayerProfileAcquisitionFunnel(events, identities, profiles)).toEqual({
      publicProfile: { signupRequests: 2, confirmedAccounts: 1, connectedPlayers: 1, paidPlayerMemberships: 0 },
      sharedProfile: { signupRequests: 1, confirmedAccounts: 1, connectedPlayers: 0, paidPlayerMemberships: 0 },
      total: { signupRequests: 3, confirmedAccounts: 2, connectedPlayers: 1, paidPlayerMemberships: 0 },
    })
  })
})
