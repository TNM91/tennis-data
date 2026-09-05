import { describe, expect, it } from 'vitest'

import { getPricingBillingCue, getPricingPlan, WHY_TENACEIQ_POINTS } from '../pricing-plans'

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
      priceLabel: '$1.99/month',
      billing: {
        amountCents: 199,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('captain')).toMatchObject({
      priceLabel: '$4.99/month',
      billing: {
        amountCents: 499,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('league')).toMatchObject({
      priceLabel: '$25/season',
      billing: {
        amountCents: 2500,
        interval: 'season',
        checkoutMode: 'one_time',
        quantityMode: 'league',
      },
    })
    expect(getPricingPlan('league').outcome).toContain('one cleaner competition')
    expect(getPricingPlan('league').outcome).not.toContain('competition workspace')
    expect(getPricingPlan('free').outcome).toContain('paid tools make your tennis life easier')
    expect(getPricingPlan('free').outcome).not.toContain('workspace makes your tennis life easier')

    expect(getPricingPlan('coach')).toMatchObject({
      priceLabel: '$4.99/month',
      billing: {
        amountCents: 499,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('full_court')).toMatchObject({
      priceLabel: '$9.99/month',
      badge: 'All Roles',
      outcome: 'Keep every tennis role connected, with unlimited Tournament Desk room.',
      billing: {
        amountCents: 999,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })
    expect(getPricingPlan('full_court').badge).not.toBe('Full Suite')
    expect(getPricingPlan('full_court').badge).not.toBe('Complete Toolkit')
    expect(getPricingPlan('full_court').outcome).not.toContain('Run every TenAceIQ workspace')

    expect(getPricingPlan('club_starter')).toMatchObject({
      priceLabel: '$99/month',
      billing: {
        amountCents: 9900,
        interval: 'month',
        checkoutMode: 'subscription',
        quantityMode: 'account',
      },
    })

    expect(getPricingPlan('club_unlimited')).toMatchObject({
      priceLabel: '$149/month',
      billing: {
        amountCents: 14900,
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
      clubStarter: false,
      clubUnlimited: false,
    })

    expect(getPricingPlan('league').entitlementGrant).toEqual({
      playerPlus: false,
      coach: false,
      captain: false,
      leagueCoordinator: true,
      tiqTeamLeagueEntry: true,
      tiqIndividualLeagueCreator: true,
      clubStarter: false,
      clubUnlimited: false,
    })

    expect(getPricingPlan('full_court').entitlementGrant).toEqual({
      playerPlus: true,
      coach: true,
      captain: true,
      leagueCoordinator: true,
      tiqTeamLeagueEntry: true,
      tiqIndividualLeagueCreator: true,
      clubStarter: false,
      clubUnlimited: false,
    })

    expect(getPricingPlan('club_starter').entitlementGrant).toMatchObject({
      clubStarter: true,
      clubUnlimited: false,
    })
    expect(getPricingPlan('club_unlimited').entitlementGrant).toMatchObject({
      clubStarter: true,
      clubUnlimited: true,
    })
  })

  it('exposes checkout-facing billing cues', () => {
    expect(getPricingBillingCue('free')).toBe('Free account')
    expect(getPricingBillingCue('player_plus')).toBe('Monthly subscription')
    expect(getPricingBillingCue('coach')).toBe('Monthly subscription')
    expect(getPricingBillingCue('captain')).toBe('Monthly subscription')
    expect(getPricingBillingCue('league')).toBe('Season fee')
    expect(getPricingBillingCue('full_court')).toBe('Monthly subscription')
    expect(getPricingBillingCue('club_starter')).toBe('Monthly subscription')
    expect(getPricingBillingCue('club_unlimited')).toBe('Monthly subscription')
  })

  it('keeps role upgrade proof concrete instead of everything-language', () => {
    const roleUpgrade = WHY_TENACEIQ_POINTS.find((point) => point.title === 'Upgrade by role')

    expect(roleUpgrade?.text).toContain('Full-Court keeps every tennis role connected.')
    expect(roleUpgrade?.text).not.toContain('Full-Court unlocks everything')
    expect(roleUpgrade?.text).not.toContain('complete tennis toolkit')
  })
})
