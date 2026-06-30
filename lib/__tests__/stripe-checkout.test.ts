import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildStripeCheckoutSessionParams,
  getStripeCheckoutMode,
  getStripePriceId,
} from '../stripe-checkout'

describe('stripe checkout helpers', () => {
  it('maps paid plans to Stripe checkout modes', () => {
    expect(getStripeCheckoutMode('player_plus')).toBe('subscription')
    expect(getStripeCheckoutMode('coach')).toBe('subscription')
    expect(getStripeCheckoutMode('captain')).toBe('subscription')
    expect(getStripeCheckoutMode('league')).toBe('payment')
    expect(getStripeCheckoutMode('full_court')).toBe('subscription')
  })

  it('resolves configured Stripe price ids by plan', () => {
    expect(getStripePriceId('player_plus', { STRIPE_PLAYER_PRICE_ID: 'price_player' })).toBe('price_player')
    expect(getStripePriceId('coach', { STRIPE_COACH_PRICE_ID: 'price_coach' })).toBe('price_coach')
    expect(getStripePriceId('captain', { STRIPE_CAPTAIN_PRICE_ID: 'price_captain' })).toBe('price_captain')
    expect(getStripePriceId('league', { STRIPE_LEAGUE_PRICE_ID: 'price_league' })).toBe('price_league')
    expect(getStripePriceId('full_court', { STRIPE_FULL_COURT_PRICE_ID: 'price_full_court' })).toBe('price_full_court')
  })

  it('documents every paid Stripe price environment variable for launch setup', () => {
    const qaDoc = readFileSync(join(process.cwd(), 'docs/stripe-lifecycle-qa.md'), 'utf8')

    for (const envName of [
      'STRIPE_PLAYER_PRICE_ID',
      'STRIPE_COACH_PRICE_ID',
      'STRIPE_CAPTAIN_PRICE_ID',
      'STRIPE_LEAGUE_PRICE_ID',
      'STRIPE_FULL_COURT_PRICE_ID',
    ]) {
      expect(qaDoc).toContain(envName)
    }
  })

  it('builds subscription Checkout Session params with request metadata', () => {
    const params = buildStripeCheckoutSessionParams({
      planId: 'captain',
      priceId: 'price_captain',
      requestId: 'request-1',
      userId: 'user-1',
      customerEmail: 'captain@example.com',
      origin: 'https://tenaceiq.test',
      nextHref: '/captain',
    })

    expect(params.get('mode')).toBe('subscription')
    expect(params.get('line_items[0][price]')).toBe('price_captain')
    expect(params.get('customer_email')).toBe('captain@example.com')
    expect(params.get('metadata[upgrade_request_id]')).toBe('request-1')
    expect(params.get('subscription_data[metadata][plan_id]')).toBe('captain')
    expect(params.get('success_url')).toBe(
      'https://tenaceiq.test/upgrade?plan=captain&next=%2Fcaptain&checkout=success&request=request-1&session_id=%7BCHECKOUT_SESSION_ID%7D',
    )
  })

  it('builds League season fee Checkout Session params with payment metadata', () => {
    const params = buildStripeCheckoutSessionParams({
      planId: 'league',
      priceId: 'price_league',
      requestId: 'request-2',
      userId: 'user-2',
      origin: 'https://tenaceiq.test',
      nextHref: '/league-coordinator',
    })

    expect(params.get('mode')).toBe('payment')
    expect(params.get('line_items[0][price]')).toBe('price_league')
    expect(params.get('allow_promotion_codes')).toBe('true')
    expect(params.get('payment_intent_data[metadata][plan_id]')).toBe('league')
    expect(params.get('cancel_url')).toBe(
      'https://tenaceiq.test/upgrade?plan=league&next=%2Fleague-coordinator&checkout=cancel&request=request-2',
    )
  })

  it('builds Coach subscription Checkout Session params with subscription metadata', () => {
    const params = buildStripeCheckoutSessionParams({
      planId: 'coach',
      priceId: 'price_coach',
      requestId: 'request-coach',
      userId: 'user-coach',
      customerEmail: 'coach@example.com',
      origin: 'https://tenaceiq.test',
      nextHref: '/coach',
    })

    expect(params.get('mode')).toBe('subscription')
    expect(params.get('line_items[0][price]')).toBe('price_coach')
    expect(params.get('customer_email')).toBe('coach@example.com')
    expect(params.get('metadata[plan_id]')).toBe('coach')
    expect(params.get('subscription_data[metadata][plan_id]')).toBe('coach')
    expect(params.get('success_url')).toBe(
      'https://tenaceiq.test/upgrade?plan=coach&next=%2Fcoach&checkout=success&request=request-coach&session_id=%7BCHECKOUT_SESSION_ID%7D',
    )
  })
})
