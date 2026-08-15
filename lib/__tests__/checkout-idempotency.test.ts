import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Stripe checkout retry safety', () => {
  it('uses a stable idempotency key and supports a restricted Stripe key', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/checkout/session/route.ts'), 'utf8')
    expect(source).toContain("'Idempotency-Key': `tenaceiq-checkout-${checkoutTarget.requestId}`")
    expect(source).toContain('STRIPE_RESTRICTED_KEY')
  })
})
