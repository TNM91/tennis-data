import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const availabilitySource = readFileSync(join(process.cwd(), 'lib/paid-checkout.ts'), 'utf8')
const checkoutRouteSource = readFileSync(join(process.cwd(), 'app/api/checkout/session/route.ts'), 'utf8')
const upgradeSource = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')
const promptSource = readFileSync(join(process.cwd(), 'app/components/upgrade-prompt.tsx'), 'utf8')
const pricingSource = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')
const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8')
const readinessSource = readFileSync(join(process.cwd(), 'scripts/stripe-live-readiness.mjs'), 'utf8')
const cutoverSource = readFileSync(join(process.cwd(), 'scripts/stripe-live-cutover-packet.mjs'), 'utf8')
const lifecycleDoc = readFileSync(join(process.cwd(), 'docs/stripe-lifecycle-qa.md'), 'utf8')

describe('paid checkout pause', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults checkout off and blocks session creation on the server', () => {
    expect(availabilitySource).toContain("process.env.NEXT_PUBLIC_PAID_CHECKOUT_ENABLED === 'true'")
    expect(checkoutRouteSource).toContain('if (!PAID_CHECKOUT_ENABLED)')
    expect(checkoutRouteSource.indexOf('if (!PAID_CHECKOUT_ENABLED)')).toBeLessThan(
      checkoutRouteSource.indexOf('const token = getBearerToken(request)'),
    )
    expect(checkoutRouteSource).toContain("code: 'checkout_paused'")
    expect(checkoutRouteSource).toContain('{ status: 503 }')
    expect(envExample).toContain('NEXT_PUBLIC_PAID_CHECKOUT_ENABLED=false')
    expect(readinessSource).toContain("'NEXT_PUBLIC_PAID_CHECKOUT_ENABLED'")
  })

  it('routes customer-facing upgrade actions to early access while paused', () => {
    expect(availabilitySource).toContain('Paid plans are opening soon.')
    expect(pricingSource).toContain("if (!PAID_CHECKOUT_ENABLED) return 'Join early access'")
    expect(promptSource).toContain("? 'Join early access'")
    expect(promptSource).toContain('PAID_CHECKOUT_PAUSED_MESSAGE')
    expect(upgradeSource).toContain('PAID_CHECKOUT_ENABLED')
    expect(upgradeSource).toContain('submittedRequest?.id ? startCheckout() : startSignedInCheckout()')
    expect(cutoverSource).toContain('Set NEXT_PUBLIC_PAID_CHECKOUT_ENABLED=false')
    expect(lifecycleDoc).toContain('Do not expose test checkout on the public site.')
  })

  it('defaults the shared checkout state to paused', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAID_CHECKOUT_ENABLED', 'false')
    vi.resetModules()
    const { PAID_CHECKOUT_ENABLED, PAID_CHECKOUT_PAUSED_MESSAGE } = await import('../paid-checkout')

    expect(PAID_CHECKOUT_ENABLED).toBe(false)
    expect(PAID_CHECKOUT_PAUSED_MESSAGE).toContain('Paid plans are opening soon.')
  })

  it('opens the shared checkout state only when intentionally enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAID_CHECKOUT_ENABLED', 'true')
    vi.resetModules()
    const { PAID_CHECKOUT_ENABLED } = await import('../paid-checkout')

    expect(PAID_CHECKOUT_ENABLED).toBe(true)
  })
})
