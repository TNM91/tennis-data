import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/api/auth/access/route.ts'), 'utf8').replace(/\r\n/g, '\n')

describe('authenticated access snapshot route', () => {
  it('uses server-safe entitlement normalization rather than importing a client module', () => {
    expect(source).toContain("from '@/lib/subscription-status'")
    expect(source).toContain('const DEFAULT_ENTITLEMENTS: ProductEntitlementSnapshot')
    expect(source).not.toContain("from '@/lib/access-model'")
  })

  it('authenticates the caller before using service access to load that caller profile', () => {
    expect(source).toContain("const token = getBearerToken(request)")
    expect(source).toContain('await requester.auth.getUser(token)')
    expect(source).toContain(".eq('id', userId)")
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('returns a complete non-cacheable role and entitlement snapshot', () => {
    expect(source).toContain('role: normalizeUserRole(row?.role ?? \'member\')')
    expect(source).toContain('entitlements: toEntitlements(row)')
    expect(source).toContain("'Cache-Control': 'no-store'")
    expect(source).toContain('captainSubscriptionActive')
    expect(source).toContain('tiqTeamLeagueEntryEnabled')
  })
})
