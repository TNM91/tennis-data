import { describe, expect, it } from 'vitest'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '../access-model'
import { getPortalTaskTarget } from '../portal-task-target'

const inactiveEntitlements: ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: false,
  playerPlusSubscriptionStatus: 'inactive',
  captainSubscriptionActive: false,
  captainSubscriptionStatus: 'inactive',
  tiqTeamLeagueEntryEnabled: false,
  tiqIndividualLeagueCreatorEnabled: false,
}

describe('portal task targets', () => {
  it('turns the My Lab task into profile setup until a paid user links a player', () => {
    const access = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
    })

    expect(getPortalTaskTarget({
      href: '/mylab',
      requiredRoute: '/mylab',
      title: 'Open My Lab',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: false,
    })).toEqual({ href: '/profile', title: 'Set profile', locked: false, requiredPlan: null })
  })

  it('keeps the My Lab task direct once the paid user has a linked player', () => {
    const access = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
    })

    expect(getPortalTaskTarget({
      href: '/mylab',
      requiredRoute: '/mylab',
      title: 'Open My Lab',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: true,
    })).toEqual({ href: '/mylab', title: 'Open My Lab', locked: false, requiredPlan: 'player_plus' })
  })

  it('keeps locked task behavior for unpaid users', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)

    expect(getPortalTaskTarget({
      href: '/mylab',
      requiredRoute: '/mylab',
      title: 'Open My Lab',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: false,
    })).toEqual({
      href: '/upgrade?plan=player_plus&next=%2Fmylab',
      title: 'Open My Lab',
      locked: true,
      requiredPlan: 'player_plus',
    })
  })

  it('turns Team subtasks into profile setup until an active Captain links a player', () => {
    const access = buildProductAccessState('member', {
      ...inactiveEntitlements,
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
    })

    expect(getPortalTaskTarget({
      href: '/captain/lineup-builder',
      requiredRoute: '/captain',
      title: 'Build lineup',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: false,
    })).toEqual({ href: '/profile', title: 'Set profile', locked: false, requiredPlan: null })

    expect(getPortalTaskTarget({
      href: '/captain/lineup-builder',
      requiredRoute: '/captain',
      title: 'Build lineup',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: true,
    })).toEqual({ href: '/captain/lineup-builder', title: 'Build lineup', locked: false, requiredPlan: 'captain' })
  })

  it('routes locked tournament entry through the Full-Court path', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)

    expect(getPortalTaskTarget({
      href: '/league-coordinator/tournaments',
      requiredRoute: '/league-coordinator',
      title: 'Build tournament',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: true,
    })).toEqual({
      href: '/upgrade?plan=full_court&next=%2Fleague-coordinator%2Ftournaments',
      title: 'Build tournament',
      locked: true,
      requiredPlan: 'full_court',
    })

    expect(getPortalTaskTarget({
      href: '/league-coordinator/tournaments',
      requiredRoute: '/league-coordinator',
      title: 'Build tournament',
      access,
      authenticated: false,
      accessPending: false,
      profileLinked: false,
    })).toEqual({
      href: '/join?plan=full_court&next=%2Fleague-coordinator%2Ftournaments',
      title: 'Build tournament',
      locked: true,
      requiredPlan: 'full_court',
    })
  })
})
