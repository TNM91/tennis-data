import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/api/checkout/session/route.ts'), 'utf8')

describe('checkout session coach plan allow-list', () => {
  it('allows Coach checkout requests through the paid plan gate', () => {
    expect(source).toContain("const PAID_PLAN_IDS: PaidPricingPlanId[] = ['player_plus', 'coach', 'captain', 'league', 'full_court']")
    expect(source).toContain('getStripePriceId(checkoutTarget.planId)')
    expect(source).toContain("'Stripe-Version': STRIPE_API_VERSION")
  })
})
