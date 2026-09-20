import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const adminHome = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')
const accessPage = readFileSync(join(process.cwd(), 'app/admin/access/page.tsx'), 'utf8')

describe('admin account tier drill-down', () => {
  it('links every tier count to the matching account filter', () => {
    expect(adminHome).toContain('href={`/admin/access?tier=${tier}`}')
    expect(adminHome).toContain('View accounts →')
    expect(adminHome).toContain('accountHealthHref(tier, health)')
    expect(adminHome).toContain("return `/admin/access?tier=${tier}&expiring=1`")
  })

  it('reads, persists, and applies the tier filter without counting admins as customers', () => {
    expect(accessPage).toContain("setPlanFilter(normalizePlanFilter(initialParams.get('tier')))")
    expect(accessPage).toContain("setQueryParam(params, 'tier', planFilter, 'all')")
    expect(accessPage).toContain("normalizedRole === 'admin' || accessByProfileId[profile.id]?.currentPlanId !== planFilter")
    expect(accessPage).toContain('id="admin-access-tier-filter"')
    expect(accessPage).toContain("onClick={() => setPlanFilter('all')}")
    expect(accessPage).toContain("setShowExpiringOnly(initialParams.get('expiring') === '1')")
    expect(accessPage).toContain("setQueryParam(params, 'expiring', showExpiringOnly ? '1' : '')")
    expect(accessPage).toContain("if (billingFilter === 'paid') return health.paid")
    expect(accessPage).toContain("if (billingFilter === 'trial') return health.trial")
    expect(accessPage).toContain("if (billingFilter === 'complimentary') return health.complimentary")
  })
})
