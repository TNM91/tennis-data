import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Stripe live catalog audit', () => {
  it('keeps a non-mutating live catalog audit aligned to paid TenAceIQ plans', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const pricingSource = readFileSync(join(process.cwd(), 'lib/pricing-plans.ts'), 'utf8')
    const qaDoc = readFileSync(join(process.cwd(), 'docs/stripe-lifecycle-qa.md'), 'utf8')
    const auditScript = readFileSync(join(process.cwd(), 'scripts/stripe-live-catalog-audit.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:stripe-live-catalog": "node scripts/stripe-live-catalog-audit.mjs"')
    expect(qaDoc).toContain('npm run qa:stripe-live-catalog')
    expect(qaDoc).toContain('npm run qa:stripe-live-catalog -- --stripe')
    expect(auditScript).toContain("STRIPE_API_VERSION = '2026-04-22.dahlia'")
    expect(auditScript).toContain('sk_live_')
    expect(auditScript).toContain('rk_live_')
    expect(auditScript).toContain('Test-mode keys are intentionally rejected')
    expect(auditScript).toContain('expand[]')
    expect(auditScript).toContain('redactStripeId')
    expect(auditScript).not.toContain('.env.local')

    for (const planId of ['player_plus', 'coach', 'captain', 'league', 'full_court']) {
      expect(auditScript).toContain(`id: '${planId}'`)
      expect(pricingSource).toContain(`${planId}: {`)
    }

    for (const amount of ['499', '999', '1499', '1999']) {
      expect(auditScript).toContain(`amountCents: ${amount}`)
      expect(pricingSource).toContain(`amountCents: ${amount}`)
    }
  })
})
