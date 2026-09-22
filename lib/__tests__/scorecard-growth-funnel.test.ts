import { describe, expect, it } from 'vitest'
import { buildScorecardSignupFunnel, getScorecardSignupIds, type ScorecardSignupProfile } from '@/lib/scorecard-growth-funnel'

const activeProfile = (id: string, overrides: Partial<ScorecardSignupProfile> = {}): ScorecardSignupProfile => ({
  id,
  linked_player_id: `player-${id}`,
  stripe_subscription_id: `sub-${id}`,
  player_plus_subscription_active: true,
  player_plus_subscription_status: 'active',
  player_plus_access_expires_at: null,
  ...overrides,
})

describe('scorecard signup funnel', () => {
  it('selects unique scorecard-sourced account requests', () => {
    const events = [
      { user_id: 'a', event_name: 'signup_confirmation_sent', plan_id: null, metadata: { acquisitionSource: 'scorecard_share' } },
      { user_id: 'a', event_name: 'signup_confirmation_sent', plan_id: null, metadata: { acquisitionSource: 'scorecard_share' } },
      { user_id: 'b', event_name: 'signup_confirmation_sent', plan_id: null, metadata: { acquisitionSource: 'direct' } },
      { user_id: 'c', event_name: 'scorecard_shared', plan_id: null, metadata: { acquisitionSource: 'scorecard_share' } },
    ]
    expect(getScorecardSignupIds(events)).toEqual(['a'])
  })

  it('counts only confirmed, linked, active paid members in the signup cohort', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const identities = ids.map((id) => ({ id, emailConfirmed: id !== 'b' }))
    const profiles = [
      activeProfile('a'),
      activeProfile('b'),
      activeProfile('c', { linked_player_id: null }),
      activeProfile('d', { stripe_subscription_id: null }),
      activeProfile('e', { player_plus_subscription_status: 'canceled' }),
      activeProfile('f', { player_plus_access_expires_at: '2026-09-01T00:00:00Z' }),
    ]

    expect(buildScorecardSignupFunnel(ids, identities, profiles, Date.parse('2026-09-22T00:00:00Z'))).toEqual({
      signupRequests: 6,
      confirmedAccounts: 5,
      connectedPlayers: 4,
      paidPlayerMemberships: 1,
    })
  })
})
