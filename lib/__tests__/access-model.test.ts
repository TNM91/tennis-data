import { describe, expect, it } from 'vitest'

import { buildProductAccessState, normalizeSubscriptionStatus } from '../access-model'
import { MEMBERSHIP_TIERS } from '../product-story'

describe('buildProductAccessState', () => {
  it('normalizes subscription statuses consistently for all paid workspaces', () => {
    expect(normalizeSubscriptionStatus('trial')).toBe('trial')
    expect(normalizeSubscriptionStatus('active')).toBe('active')
    expect(normalizeSubscriptionStatus('past_due')).toBe('past_due')
    expect(normalizeSubscriptionStatus('canceled')).toBe('canceled')
    expect(normalizeSubscriptionStatus('incomplete')).toBe('inactive')
    expect(normalizeSubscriptionStatus(null)).toBe('inactive')
  })

  it('keeps Coordinator access independent from Player and Captain', () => {
    const access = buildProductAccessState('member', {
      playerPlusSubscriptionActive: false,
      playerPlusSubscriptionStatus: 'inactive',
      captainSubscriptionActive: false,
      captainSubscriptionStatus: 'inactive',
      tiqTeamLeagueEntryEnabled: true,
      tiqIndividualLeagueCreatorEnabled: false,
    })

    expect(access.currentPlanId).toBe('league')
    expect(access.canUseAdvancedPlayerInsights).toBe(false)
    expect(access.canUseCaptainWorkflow).toBe(false)
    expect(access.canUseLeagueTools).toBe(true)
    expect(access.canCreateTiqTeamLeague).toBe(true)
    expect(access.canEnterTiqTeamLeague).toBe(true)
    expect(access.canCreateTiqIndividualLeague).toBe(false)
  })

  it('does not unlock team result entry for individual-only Coordinator access', () => {
    const access = buildProductAccessState('member', {
      playerPlusSubscriptionActive: false,
      playerPlusSubscriptionStatus: 'inactive',
      captainSubscriptionActive: false,
      captainSubscriptionStatus: 'inactive',
      tiqTeamLeagueEntryEnabled: false,
      tiqIndividualLeagueCreatorEnabled: true,
    })

    expect(access.currentPlanId).toBe('league')
    expect(access.canUseLeagueTools).toBe(true)
    expect(access.canCreateTiqTeamLeague).toBe(false)
    expect(access.canEnterTiqTeamLeague).toBe(false)
    expect(access.canCreateTiqIndividualLeague).toBe(true)
  })

  it('reuses centralized tier story for access labels and messages', () => {
    const freeAccess = buildProductAccessState('member')

    expect(freeAccess.playerPlusLabel).toBe(`${MEMBERSHIP_TIERS.player_plus.name} - $4.99/month`)
    expect(freeAccess.playerPlusMessage).toBe(MEMBERSHIP_TIERS.player_plus.description)
    expect(freeAccess.captainTierLabel).toBe(`${MEMBERSHIP_TIERS.captain.name} - $9.99/month`)
    expect(freeAccess.captainTierMessage).toBe(MEMBERSHIP_TIERS.captain.description)
    expect(freeAccess.coachTierLabel).toBe(`${MEMBERSHIP_TIERS.coach.name} - $9.99/month`)
    expect(freeAccess.coachTierMessage).toBe(MEMBERSHIP_TIERS.coach.description)
    expect(freeAccess.leagueTierLabel).toBe(`${MEMBERSHIP_TIERS.league.name} - $14.99/season workspace`)
    expect(freeAccess.leagueTierMessage).toBe(MEMBERSHIP_TIERS.league.description)
    expect(freeAccess.teamLeagueMessage).toContain(MEMBERSHIP_TIERS.league.upgradeCue)
    expect(freeAccess.individualLeagueMessage).toContain(MEMBERSHIP_TIERS.league.upgradeCue)

    const captainAccess = buildProductAccessState('captain')

    expect(captainAccess.playerPlusLabel).toBe(`${MEMBERSHIP_TIERS.player_plus.name} active`)
    expect(captainAccess.playerPlusMessage).toContain(MEMBERSHIP_TIERS.player_plus.description)
    expect(captainAccess.captainTierLabel).toBe(`${MEMBERSHIP_TIERS.captain.name} active`)
    expect(captainAccess.captainTierMessage).toContain(MEMBERSHIP_TIERS.captain.description)
  })

  it('keeps admin access active even when profile entitlement flags are false', () => {
    const access = buildProductAccessState('admin', {
      playerPlusSubscriptionActive: false,
      playerPlusSubscriptionStatus: 'inactive',
      captainSubscriptionActive: false,
      captainSubscriptionStatus: 'inactive',
      tiqTeamLeagueEntryEnabled: false,
      tiqIndividualLeagueCreatorEnabled: false,
    })

    expect(access.currentPlanId).toBe('full_court')
    expect(access.canUseAdvancedPlayerInsights).toBe(true)
    expect(access.canUseCoachWorkflow).toBe(true)
    expect(access.canUseCaptainWorkflow).toBe(true)
    expect(access.canUseLeagueTools).toBe(true)
  })
})
