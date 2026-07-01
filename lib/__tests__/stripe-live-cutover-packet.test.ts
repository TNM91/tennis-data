import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Stripe live cutover packet', () => {
  it('keeps a secret-free owner packet for the live Stripe cutover', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const qaDoc = readFileSync(join(process.cwd(), 'docs/stripe-lifecycle-qa.md'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const packetScript = readFileSync(join(process.cwd(), 'scripts/stripe-live-cutover-packet.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:stripe-live-cutover": "node scripts/stripe-live-cutover-packet.mjs"')
    expect(qaDoc).toContain('npm run qa:stripe-live-cutover')
    expect(deployChecklist).toContain('npm run qa:stripe-live-cutover')
    expect(packetScript).toContain('https://docs.stripe.com/get-started/checklist/go-live')
    expect(packetScript).toContain('https://www.tenaceiq.com/api/stripe/webhook')
    expect(packetScript).toContain('2026-04-22.dahlia')
    expect(packetScript).toContain('STRIPE_WEBHOOK_SECRET')
    expect(packetScript).toContain('STRIPE_FULL_COURT_PRICE_ID')
    expect(packetScript).toContain('checkout.session.completed')
    expect(packetScript).toContain('invoice.payment_failed')
    expect(packetScript).toContain('npm run qa:stripe-live-catalog -- --stripe')
    expect(packetScript).toContain('npm run qa:stripe-live-mode')
    expect(packetScript).toContain('node scripts/stripe-checkout-mode-smoke.mjs --expect=test --plan=coach')
    expect(packetScript).not.toContain('sk_live_')
    expect(packetScript).not.toContain('rk_live_')
    expect(packetScript).not.toContain('whsec_')
    expect(packetScript).not.toContain('.env.local')
  })
})
