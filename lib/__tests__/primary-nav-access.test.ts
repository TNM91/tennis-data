import { describe, expect, it } from 'vitest'
import { buildProductAccessState } from '../access-model'
import {
  canUsePrimaryNavItem,
  getPrimaryNavLockedLabel,
  getPrimaryNavLockedTitle,
  getPrimaryNavTarget,
  getRequiredPlanForPrimaryNav,
} from '../primary-nav-access'

describe('primary nav access', () => {
  it('routes public locked tools through upgrade preview with the required plan intent', () => {
    const access = buildProductAccessState('public')

    expect(getPrimaryNavTarget('/mylab', access, false)).toEqual({
      href: '/upgrade?plan=player_plus&next=%2Fmylab',
      locked: true,
      requiredPlan: 'player_plus',
    })
  })

  it('treats Tactics Tools as a Player access surface', () => {
    const freeAccess = buildProductAccessState('member')
    const playerAccess = buildProductAccessState('member', {
      playerPlusSubscriptionActive: true,
      playerPlusSubscriptionStatus: 'active',
      captainSubscriptionActive: false,
      captainSubscriptionStatus: 'inactive',
      tiqTeamLeagueEntryEnabled: false,
      tiqIndividualLeagueCreatorEnabled: false,
    })

    expect(getRequiredPlanForPrimaryNav('/tactics')).toBe('player_plus')
    expect(canUsePrimaryNavItem(freeAccess, '/tactics')).toBe(false)
    expect(canUsePrimaryNavItem(playerAccess, '/tactics')).toBe(true)
    expect(getPrimaryNavTarget('/tactics', freeAccess, true)).toEqual({
      href: '/upgrade?plan=player_plus&next=%2Ftactics',
      locked: true,
      requiredPlan: 'player_plus',
    })
  })

  it('routes signed-in locked tools through upgrade with the required plan intent', () => {
    const access = buildProductAccessState('member')

    expect(getPrimaryNavTarget('/league-coordinator', access, true)).toEqual({
      href: '/upgrade?plan=league&next=%2Fleague-coordinator',
      locked: true,
      requiredPlan: 'league',
    })
  })

  it('explains that a free account starts access before the paid plan activates', () => {
    expect(getPrimaryNavLockedLabel('League', 'league')).toBe(
      'League requires League Office access. Create a free account first, then activate League Office access.',
    )
  })

  it('uses the League Office name for league lock titles', () => {
    expect(getPrimaryNavLockedTitle('League', 'league')).toBe('League requires League Office access')
  })
})
