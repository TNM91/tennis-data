import { describe, expect, it } from 'vitest'

import { getPricingBillingCue, getPricingPlan } from '../pricing-plans'

describe('pricing plans', () => {
  it('keeps the public price labels backed by structured billing terms', () => {
    expect(getPricingPlan('free')).toMatchObject({
      priceLabel: '$0',
      billing: {
        amountCents: 0,
        interval: 'none',
        checkoutMode: 'none',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('player_plus')).toMatchObject({
      priceLabel: '$4.99/month',
      billing: {
        amountCents: 499,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('captain')).toMatchObject({
      priceLabel: '$9.99/month',
      billing: {
        amountCents: 999,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('league')).toMatchObject({
      priceLabel: '$25/season per league',
      billing: {
        amountCents: 2500,
        interval: 'season',
        checkoutMode: 'one_time',
        quantityMode: 'league',
      },
    })
  })

  it('keeps Captain and Coordinator entitlement grants separate', () => {
    expect(getPricingPlan('captain').entitlementGrant).toEqual({
      playerPlus: true,
      captain: true,
      leagueCoordinator: false,
      tiqTeamLeagueEntry: false,
      tiqIndividualLeagueCreator: false,
    })

    expect(getPricingPlan('league').entitlementGrant).toEqual({
      playerPlus: false,
      captain: false,
      leagueCoordinator: true,
      tiqTeamLeagueEntry: true,
      tiqIndividualLeagueCreator: true,
    })
  })

  it('models the Coordinator captain discount without changing base price', () => {
    const leaguePlan = getPricingPlan('league')

    expect(leaguePlan.alternatePriceNote).toBe('Captains get 1/2 off their first league')
    expect(leaguePlan.discountRules).toEqual([
      {
        id: 'captain_first_league_half_off',
        label: 'Captains get 1/2 off their first league',
        percentOff: 50,
        appliesToPlanId: 'league',
        eligibility: 'active_captain_first_league',
      },
    ])
  })

  it('exposes checkout-facing billing cues', () => {
    expect(getPricingBillingCue('free')).toBe('Free account')
    expect(getPricingBillingCue('player_plus')).toBe('Monthly subscription')
    expect(getPricingBillingCue('captain')).toBe('Monthly subscription')
    expect(getPricingBillingCue('league')).toBe('Season fee')
  })
})
