import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/auth-provider.tsx'), 'utf8')

describe('auth provider stability', () => {
  it('does not collapse unresolved session checks to public/free access', () => {
    expect(source).toContain('const AUTH_SESSION_TIMEOUT')
    expect(source).toContain('function isAuthSessionTimeout')
    expect(source).toContain('if (isAuthSessionTimeout(sessionResult))')
    expect(source).toContain('let resolvedAuthState = false')
    expect(source).toContain('mountedRef.current && resolvedAuthState')
    expect(source).not.toContain("{ data: { session: null }, error: null },")
  })

  it('marks signed-in auth transitions unresolved until role and entitlements are loaded', () => {
    expect(source).toContain('setAuthResolved(false)')
    expect(source).toContain('setRole(nextRole)')
    expect(source).toContain('setEntitlements(nextEntitlements)')
    expect(source).toContain('setAuthResolved(true)')
  })
})
