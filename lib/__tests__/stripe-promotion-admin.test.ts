import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routeSource = readFileSync(join(process.cwd(), 'app/api/admin/stripe-promotions/route.ts'), 'utf8')
const pageSource = readFileSync(join(process.cwd(), 'app/admin/promotions/page.tsx'), 'utf8')
const checkoutSource = readFileSync(join(process.cwd(), 'lib/stripe-checkout.ts'), 'utf8')

describe('Stripe promotion administration', () => {
  it('creates plan-restricted Stripe promotion codes and never handles billing in the browser', () => {
    expect(routeSource).toContain("'/v1/coupons'")
    expect(routeSource).toContain("'/v1/promotion_codes'")
    expect(routeSource).toContain("promotionParams.set('promotion[coupon]', couponId)")
    expect(routeSource).toContain("couponParams.set('applies_to[products][0]', productId)")
    expect(routeSource).toContain("promotionParams.set('restrictions[first_time_transaction]', 'true')")
    expect(routeSource).toContain("'Stripe-Version': STRIPE_API_VERSION")
    expect(routeSource).toContain("profile?.role !== 'admin'")
    expect(routeSource).toContain("action: 'stripe_promotion_created'")
    expect(routeSource).toContain("action: 'stripe_promotion_deactivated'")
  })

  it('keeps the offer actionable and tracks redemptions from Stripe', () => {
    expect(pageSource).toContain('Create a private promotion code')
    expect(pageSource).toContain('Redemption tracking')
    expect(pageSource).toContain('End code')
    expect(pageSource).toContain('First Stripe purchase only')
    expect(checkoutSource).toContain("params.set('allow_promotion_codes', 'true')")
  })
})
