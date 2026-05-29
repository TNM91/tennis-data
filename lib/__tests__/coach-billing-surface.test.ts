import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const setupRoute = readFileSync(join(process.cwd(), 'app/api/upgrade-requests/setup/route.ts'), 'utf8')
const billingPolicy = readFileSync(join(process.cwd(), 'lib/billing-policy.ts'), 'utf8')
const termsPage = readFileSync(join(process.cwd(), 'app/legal/terms/page.tsx'), 'utf8')
const pricingPage = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')
const adminPage = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')

describe('Coach billing and setup surface', () => {
  it('keeps Coach present in setup diagnostics and billing copy', () => {
    expect(setupRoute).toContain('coach_subscription_active, coach_subscription_status')
    expect(billingPolicy).toContain('Player, Coach, Captain, and Full-Court monthly subscriptions')
    expect(billingPolicy).toContain('Player, Coach, Captain, and Full-Court plans renew monthly')
    expect(termsPage).toContain('Paid Player, Coach, Captain, and Full-Court plans are monthly subscriptions')
    expect(pricingPage).toContain('Player, Coach, Captain, and Full-Court are monthly subscriptions')
    expect(adminPage).toContain('Manage Player, Coach, Captain, and League Office entitlement flags')
    expect(adminPage).not.toContain('Manage Player, Coach, Captain, and TIQ league entitlement flags')
    expect(adminPage).toContain('Coach subscription')
  })
})
