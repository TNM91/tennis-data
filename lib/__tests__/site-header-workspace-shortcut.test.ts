import { describe, expect, it } from 'vitest'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '../access-model'
import { getHeaderWorkspaceShortcut } from '../site-header-workspace-shortcut'

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

describe('site header workspace shortcut', () => {
  it('does not show an account shortcut for guests', () => {
    const access = buildProductAccessState('public', null)

    expect(getHeaderWorkspaceShortcut(access, false)).toBeNull()
  })

  it('routes unpaid members to public tennis discovery', () => {
    const access = buildProductAccessState('member', inactiveEntitlements)

    expect(getHeaderWorkspaceShortcut(access, true)).toEqual({
      href: '/explore',
      label: 'Find tennis',
    })
  })

  it('routes Player users to My Lab', () => {
    const access = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
    })

    expect(getHeaderWorkspaceShortcut(access, true)).toEqual({
      href: '/mylab',
      label: 'My Lab',
    })
  })

  it('prioritizes Coach, Team, and League workspaces by operational scope', () => {
    const coachAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      coachSubscriptionActive: true,
      coachSubscriptionStatus: 'active',
    })
    const captainAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
      coachSubscriptionActive: true,
      coachSubscriptionStatus: 'active',
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
    })
    const leagueAccess = buildProductAccessState('member', {
      ...inactiveEntitlements,
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
      coachSubscriptionActive: true,
      coachSubscriptionStatus: 'active',
      captainSubscriptionActive: true,
      captainSubscriptionStatus: 'active',
      tiqTeamLeagueEntryEnabled: true,
    })

    expect(getHeaderWorkspaceShortcut(coachAccess, true)).toEqual({
      href: '/coach',
      label: 'Coach Hub',
    })
    expect(getHeaderWorkspaceShortcut(captainAccess, true)).toEqual({
      href: '/captain',
      label: 'Team Hub',
    })
    expect(getHeaderWorkspaceShortcut(leagueAccess, true)).toEqual({
      href: '/league-coordinator',
      label: 'League Office',
    })
  })
})
