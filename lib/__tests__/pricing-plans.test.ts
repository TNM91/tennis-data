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
      priceLabel: '$14.99/season workspace',
      billing: {
        amountCents: 1499,
        interval: 'season',
        checkoutMode: 'one_time',
        quantityMode: 'league',
      },
    })

    expect(getPricingPlan('coach')).toMatchObject({
      priceLabel: '$9.99/month',
      billing: {
        amountCents: 999,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('full_court')).toMatchObject({
      priceLabel: '$19.99/month',
      billing: {
        amountCents: 1999,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })
  })

  it('keeps Captain, League, and Full-Court entitlement grants clear', () => {
    expect(getPricingPlan('captain').entitlementGrant).toEqual({
      playerPlus: true,
      coach: false,
      captain: true,
      leagueCoordinator: false,
      tiqTeamLeagueEntry: false,
      tiqIndividualLeagueCreator: false,
    })

    expect(getPricingPlan('league').entitlementGrant).toEqual({
      playerPlus: false,
      coach: false,
      captain: false,
      leagueCoordinator: true,
      tiqTeamLeagueEntry: true,
      tiqIndividualLeagueCreator: true,
    })

    expect(getPricingPlan('full_court').entitlementGrant).toEqual({
      playerPlus: true,
      coach: true,
      captain: true,
      leagueCoordinator: true,
      tiqTeamLeagueEntry: true,
      tiqIndividualLeagueCreator: true,
    })
  })

  it('exposes checkout-facing billing cues', () => {
    expect(getPricingBillingCue('free')).toBe('Free account')
    expect(getPricingBillingCue('player_plus')).toBe('Monthly subscription')
    expect(getPricingBillingCue('coach')).toBe('Monthly subscription')
    expect(getPricingBillingCue('captain')).toBe('Monthly subscription')
    expect(getPricingBillingCue('league')).toBe('Season fee')
    expect(getPricingBillingCue('full_court')).toBe('Monthly subscription')
  })
})
