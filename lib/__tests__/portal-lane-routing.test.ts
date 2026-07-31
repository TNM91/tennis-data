import { describe, expect, it } from 'vitest'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '../access-model'
import { getPortalLaneTarget } from '../portal-lane-routing'

const inactiveEntitlements: ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: false,
  playerPlusSubscriptionStatus: 'inactive',
  captainSubscriptionActive: false,
  captainSubscriptionStatus: 'inactive',
  tiqTeamLeagueEntryEnabled: false,
  tiqIndividualLeagueCreatorEnabled: false,
}

describe('portal lane routing', () => {
  it('opens every main lane on its hub or preview landing page', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)

    const lanes = [
      { laneId: 'find' as const, fallbackHref: '/explore', planRoute: '/explore' as const },
      { laneId: 'you' as const, fallbackHref: '/player-development', planRoute: '/player-development' as const },
      { laneId: 'compete' as const, fallbackHref: '/compete', planRoute: '/compete' as const },
      { laneId: 'coach' as const, fallbackHref: '/coaches', planRoute: '/coach' as const },
      { laneId: 'team' as const, fallbackHref: '/captain', planRoute: '/captain' as const },
      { laneId: 'league' as const, fallbackHref: '/leagues-and-tournaments', planRoute: '/league-coordinator' as const },
    ]

    for (const lane of lanes) {
      expect(getPortalLaneTarget({
        ...lane,
        access,
        authenticated: true,
        accessPending: false,
      })).toEqual({ href: lane.fallbackHref, locked: false, requiredPlan: null })
    }
  })

  it('keeps the League lane on the organizer hub even for users with League Office access', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)
    const leagueAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      tiqTeamLeagueEntryEnabled: true,
    })

    for (const currentAccess of [access, leagueAccess]) {
      expect(getPortalLaneTarget({
        laneId: 'league',
        fallbackHref: '/leagues-and-tournaments',
        planRoute: '/league-coordinator',
        access: currentAccess,
        authenticated: true,
        accessPending: false,
      })).toEqual({ href: '/leagues-and-tournaments', locked: false, requiredPlan: null })
    }
  })

  it('keeps paid workspace access out of the main lane decision', () => {
    const freeAccess = buildProductAccessState('member', inactiveEntitlements)
    const paidAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
      coachSubscriptionActive: true,
      coachSubscriptionStatus: 'active',
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
      tiqTeamLeagueEntryEnabled: true,
    })

    for (const access of [freeAccess, paidAccess]) {
      expect(getPortalLaneTarget({
        laneId: 'coach',
        fallbackHref: '/coaches',
        planRoute: '/coach',
        access,
        authenticated: true,
        accessPending: false,
      })).toEqual({ href: '/coaches', locked: false, requiredPlan: null })

      expect(getPortalLaneTarget({
        laneId: 'team',
        fallbackHref: '/captain',
        planRoute: '/captain',
        access,
        authenticated: true,
        accessPending: false,
      })).toEqual({ href: '/captain', locked: false, requiredPlan: null })
    }
  })
})
