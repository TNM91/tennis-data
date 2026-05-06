import { describe, expect, it } from 'vitest'

import {
  buildUpgradePricingSnapshot,
  mapUpgradeRequestRecordToInsert,
  mapUpgradeRequestRow,
  type UpgradeRequestRow,
} from '../upgrade-requests'

describe('upgrade request pricing snapshots', () => {
  it('adds checkout-ready pricing metadata to new upgrade request inserts', () => {
    expect(mapUpgradeRequestRecordToInsert({
      id: '',
      planId: 'league',
      planName: 'TIQ League Coordinator',
      name: 'Organizer',
      email: 'organizer@example.com',
      organization: 'Tuesday Ladder',
      goal: 'Run a season',
      nextHref: '/league-coordinator',
      createdAt: '',
    })).toMatchObject({
      plan_id: 'league',
      plan_name: 'TIQ League Coordinator',
      price_label: '$25/season per league',
      billing_amount_cents: 2500,
      billing_currency: 'usd',
      billing_interval: 'season',
      checkout_mode: 'one_time',
      quantity_mode: 'league',
      entitlement_grant: {
        playerPlus: false,
        captain: false,
        leagueCoordinator: true,
        tiqTeamLeagueEntry: true,
        tiqIndividualLeagueCreator: true,
      },
      discount_rules: [
        {
          id: 'captain_first_league_half_off',
          percentOff: 50,
        },
      ],
    })
  })

  it('fills old rows from the current pricing contract when snapshot columns are missing', () => {
    const row: UpgradeRequestRow = {
      id: 'request-1',
      plan_id: 'captain',
      plan_name: 'Captain',
      requester_name: 'Captain User',
      requester_email: 'captain@example.com',
      requester_user_id: null,
      organization: 'Aces',
      goal: 'Build lineups',
      next_href: '/captain',
      status: 'pending',
      source: 'upgrade_page',
      created_at: '2026-05-05T00:00:00.000Z',
      updated_at: '2026-05-05T00:00:00.000Z',
    }

    expect(mapUpgradeRequestRow(row)).toMatchObject({
      planId: 'captain',
      priceLabel: '$9.99/month',
      billingAmountCents: 999,
      billingCurrency: 'usd',
      billingInterval: 'month',
      checkoutMode: 'subscription',
      quantityMode: 'account',
      entitlementGrant: {
        playerPlus: true,
        captain: true,
        leagueCoordinator: false,
      },
    })
  })

  it('builds the same snapshot used by local fallback requests', () => {
    expect(buildUpgradePricingSnapshot('player_plus')).toMatchObject({
      planName: 'Player',
      priceLabel: '$4.99/month',
      billingAmountCents: 499,
      billingInterval: 'month',
      checkoutMode: 'subscription',
      quantityMode: 'account',
    })
  })
})
