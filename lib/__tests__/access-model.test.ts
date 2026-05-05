import { describe, expect, it } from 'vitest'

import { buildProductAccessState } from '../access-model'

describe('buildProductAccessState', () => {
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
})
