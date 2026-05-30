import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')

describe('pricing auth access rendering', () => {
  it('uses the shared auth provider before marking plans active', () => {
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('function PricingContent()')
    expect(source).toContain('const { role, userId, entitlements, authResolved } = useAuth()')
    expect(source).toContain("const resolvedRole = authResolved || !userId ? role : 'member'")
    expect(source).toContain('const accessPending = !authResolved || (Boolean(userId) && entitlements === null)')
    expect(source).not.toContain('getClientAuthState')
  })

  it('keeps current-plan and recommendation cues neutral while auth resolves', () => {
    expect(source).toContain('Checking access')
    expect(source).toContain('const active = !accessPending && isPlanActive(plan.id, access)')
    expect(source).toContain('const recommended = !accessPending && !active && recommendedPlanId === plan.id')
    expect(source).toContain("href={accessPending ? '#pricing-plans' : getPlanHref")
    expect(source).toContain("{accessPending ? 'View tiers' : getPlanCta")
  })
})
