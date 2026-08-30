import { describe, expect, it } from 'vitest'
import { buildStripeCheckoutSessionParams } from '@/lib/stripe-checkout'

describe('Stripe Captain Pilot checkout', () => {
  it('uses a calendar trial end and campaign metadata without accepting another promo code', () => {
    const params = buildStripeCheckoutSessionParams({
      planId: 'captain',
      priceId: 'price_captain',
      requestId: 'pilot-request',
      userId: 'pilot-user',
      origin: 'https://www.tenaceiq.com',
      nextHref: '/captain',
      trialEnd: 1798761600,
      campaignKey: 'fall-2026-captain-pilot',
      pilotRedemptionId: 'pilot-redemption',
      allowPromotionCodes: false,
    })

    expect(params.get('mode')).toBe('subscription')
    expect(params.get('subscription_data[trial_end]')).toBe('1798761600')
    expect(params.get('payment_method_collection')).toBe('always')
    expect(params.get('metadata[campaign_key]')).toBe('fall-2026-captain-pilot')
    expect(params.get('subscription_data[metadata][pilot_redemption_id]')).toBe('pilot-redemption')
    expect(params.has('allow_promotion_codes')).toBe(false)
  })
})
