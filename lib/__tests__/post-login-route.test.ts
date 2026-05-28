import { describe, expect, it } from 'vitest'
import { getDefaultProductHomeRoute } from '../post-login-route'
import { type ProductEntitlementSnapshot } from '../access-model'

const inactiveEntitlements: ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: false,
  playerPlusSubscriptionStatus: 'inactive',
  coachSubscriptionActive: false,
  coachSubscriptionStatus: 'inactive',
  captainSubscriptionActive: false,
  captainSubscriptionStatus: 'inactive',
  tiqTeamLeagueEntryEnabled: false,
  tiqIndividualLeagueCreatorEnabled: false,
}

describe('post-login product routing', () => {
  it('lands free members in Find instead of the public homepage', () => {
    expect(getDefaultProductHomeRoute('member', inactiveEntitlements, false)).toBe('/explore/search')
  })

  it('lands Player users in My Lab once their player is linked', () => {
    expect(getDefaultProductHomeRoute('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
    }, true)).toBe('/mylab')
  })

  it('sends Player users to profile only when no player identity is linked yet', () => {
    expect(getDefaultProductHomeRoute('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
    }, false)).toBe('/profile')
  })

  it('lands Captain users in the Captain workspace once their player is linked', () => {
    expect(getDefaultProductHomeRoute('member', {
      ...inactiveEntitlements,
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
    }, true)).toBe('/captain')
  })

  it('lands Coach users in the Coach workspace even before a player identity is linked', () => {
    expect(getDefaultProductHomeRoute('member', {
      ...inactiveEntitlements,
      coachSubscriptionActive: true,
      coachSubscriptionStatus: 'active',
    }, false)).toBe('/coach')
  })

  it('lands League and Full-Court users in the coordinator workspace first', () => {
    expect(getDefaultProductHomeRoute('member', {
      ...inactiveEntitlements,
      tiqTeamLeagueEntryEnabled: true,
    }, false)).toBe('/league-coordinator')

    expect(getDefaultProductHomeRoute('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
      tiqTeamLeagueEntryEnabled: true,
    }, false)).toBe('/league-coordinator')
  })
})
