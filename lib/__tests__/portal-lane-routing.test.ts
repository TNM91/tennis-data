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
  it('keeps the League lane public for guests and free members', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)

    expect(getPortalLaneTarget({
      laneId: 'league',
      fallbackHref: '/compete',
      planRoute: '/league-coordinator',
      access,
      authenticated: true,
      accessPending: false,
    })).toEqual({ href: '/compete', locked: false, requiredPlan: null })
  })

  it('opens the coordinator workspace for League and Full-Court users', () => {
    const leagueAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      tiqTeamLeagueEntryEnabled: true,
    })
    const fullCourtAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
      tiqTeamLeagueEntryEnabled: true,
    })

    for (const access of [leagueAccess, fullCourtAccess]) {
      expect(getPortalLaneTarget({
        laneId: 'league',
        fallbackHref: '/compete',
        planRoute: '/league-coordinator',
        access,
        authenticated: true,
        accessPending: false,
      })).toEqual({ href: '/league-coordinator', locked: false, requiredPlan: null })
    }
  })

  it('keeps non-league paid lanes on their existing lock-aware target rules', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)

    expect(getPortalLaneTarget({
      laneId: 'team',
      fallbackHref: '/captain',
      planRoute: '/captain',
      access,
      authenticated: true,
      accessPending: false,
    })).toEqual({ href: '/upgrade?plan=captain&next=%2Fcaptain', locked: true, requiredPlan: 'captain' })
  })

  it('routes the Coach lane through Coach plan access', () => {
    const freeAccess = buildProductAccessState('member', inactiveEntitlements)
    const coachAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      coachSubscriptionActive: true,
      coachSubscriptionStatus: 'active',
    })

    expect(getPortalLaneTarget({
      laneId: 'coach',
      fallbackHref: '/coach',
      planRoute: '/coach',
      access: freeAccess,
      authenticated: true,
      accessPending: false,
    })).toEqual({ href: '/upgrade?plan=coach&next=%2Fcoach', locked: true, requiredPlan: 'coach' })

    expect(getPortalLaneTarget({
      laneId: 'coach',
      fallbackHref: '/coach',
      planRoute: '/coach',
      access: coachAccess,
      authenticated: true,
      accessPending: false,
    })).toEqual({ href: '/coach', locked: false, requiredPlan: 'coach' })
  })

  it('routes paid You lane users to profile setup until their player identity is linked', () => {
    const access = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
    })

    expect(getPortalLaneTarget({
      laneId: 'you',
      fallbackHref: '/mylab',
      planRoute: '/mylab',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: false,
    })).toEqual({ href: '/profile', locked: false, requiredPlan: null })

    expect(getPortalLaneTarget({
      laneId: 'you',
      fallbackHref: '/mylab',
      planRoute: '/mylab',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: true,
    })).toEqual({ href: '/mylab', locked: false, requiredPlan: 'player_plus' })
  })

  it('routes active Captain users to profile setup until their player identity is linked', () => {
    const access = buildProductAccessState('member', {
      ...inactiveEntitlements,
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
    })

    expect(getPortalLaneTarget({
      laneId: 'team',
      fallbackHref: '/captain',
      planRoute: '/captain',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: false,
    })).toEqual({ href: '/profile', locked: false, requiredPlan: null })

    expect(getPortalLaneTarget({
      laneId: 'team',
      fallbackHref: '/captain',
      planRoute: '/captain',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: true,
    })).toEqual({ href: '/captain', locked: false, requiredPlan: 'captain' })
  })
})
