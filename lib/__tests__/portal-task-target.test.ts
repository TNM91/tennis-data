import { describe, expect, it } from 'vitest'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '../access-model'
import { getPortalTaskTarget } from '../portal-task-target'

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

describe('portal task targets', () => {
  it('keeps the My Lab task direct for paid users', () => {
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
    })).toEqual({ href: '/mylab', title: 'Open My Lab', locked: false, requiredPlan: 'player_plus' })
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

  it('keeps Team subtasks direct for active Captain users', () => {
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
    })).toEqual({ href: '/captain/lineup-builder', title: 'Build lineup', locked: false, requiredPlan: 'captain' })

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

  it('keeps Coach Bench anchored for active coaches', () => {
    const access = buildProductAccessState('member', {
      ...inactiveEntitlements,
      coachSubscriptionActive: true,
      coachSubscriptionStatus: 'active',
    })

    expect(getPortalTaskTarget({
      href: '/coach#coach-linked-dashboard',
      requiredRoute: '/coach',
      title: 'Player bench',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: true,
    })).toEqual({
      href: '/coach#coach-linked-dashboard',
      title: 'Player bench',
      locked: false,
      requiredPlan: 'coach',
    })
  })

  it('preserves the Coach Bench anchor through the locked unlock path', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)

    expect(getPortalTaskTarget({
      href: '/coach#coach-linked-dashboard',
      requiredRoute: '/coach',
      title: 'Player bench',
      access,
      authenticated: true,
      accessPending: false,
      profileLinked: true,
    })).toEqual({
      href: '/upgrade?plan=coach&next=%2Fcoach%23coach-linked-dashboard',
      title: 'Player bench',
      locked: true,
      requiredPlan: 'coach',
    })
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
      href: '/upgrade?plan=full_court&next=%2Fleague-coordinator%2Ftournaments',
      title: 'Build tournament',
      locked: true,
      requiredPlan: 'full_court',
    })
  })
})
