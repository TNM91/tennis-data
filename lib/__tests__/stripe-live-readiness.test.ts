import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Stripe live readiness command', () => {
  it('keeps a non-secret live-mode readiness guard in the launch flow', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const qaDoc = readFileSync(join(process.cwd(), 'docs/stripe-lifecycle-qa.md'), 'utf8')
    const readinessScript = readFileSync(join(process.cwd(), 'scripts/stripe-live-readiness.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:stripe-live-readiness": "node scripts/stripe-live-readiness.mjs"')
    expect(qaDoc).toContain('npm run qa:stripe-live-readiness')
    expect(qaDoc).toContain('https://docs.stripe.com/get-started/checklist/go-live')
    expect(readinessScript).toContain('STRIPE_SECRET_KEY')
    expect(readinessScript).toContain('STRIPE_WEBHOOK_SECRET')
    expect(readinessScript).toContain('STRIPE_FULL_COURT_PRICE_ID')
    expect(readinessScript).toContain('checkout.session.completed')
    expect(readinessScript).toContain('customer.subscription.updated')
    expect(readinessScript).toContain('invoice.payment_failed')
    expect(readinessScript).toContain('--vercel')
    expect(readinessScript).not.toContain('.env.local')
  })
})
