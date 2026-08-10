import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/auth-provider.tsx'), 'utf8').replace(/\r\n/g, '\n')

describe('auth provider stability', () => {
  it('does not collapse unresolved session checks to public/free access', () => {
    expect(source).toContain('const AUTH_SESSION_TIMEOUT')
    expect(source).toContain('function isAuthSessionTimeout')
    expect(source).toContain('if (isAuthSessionTimeout(sessionResult))')
    expect(source).toContain('if (isAuthSessionTimeout(sessionResult)) {\n        return null')
    expect(source).toContain('} catch {\n      return null')
    expect(source).not.toContain("{ data: { session: null }, error: null },")
  })

  it('marks signed-in auth transitions unresolved until role and entitlements are loaded', () => {
    expect(source).toContain('setAuthResolved(false)')
    expect(source).toContain('setRole(nextRole)')
    expect(source).toContain('setEntitlements(nextEntitlements)')
    expect(source).toContain('setAuthResolved(true)')
  })

  it('returns the resolved snapshot from manual auth refreshes', () => {
    expect(source).toContain('refreshAuth: () => Promise<AuthRefreshState | null>')
    expect(source).toContain('type AuthRefreshState')
    expect(source).toContain('userId: nextUserId')
    expect(source).toContain("role: 'public'")
  })

  it('preserves confirmed access through transient entitlement failures', () => {
    expect(source).toContain('const sessionRef = useRef<Session | null>(null)')
    expect(source).toContain('const entitlementsRef = useRef<ProductEntitlementSnapshot | null>(null)')
    expect(source).toContain('const hasCurrentAccess =')
    expect(source).toContain('previousUserId && previousUserId !== nextUserId')
    expect(source).toContain("if (!mountedRef.current || sessionRef.current?.user?.id !== nextUserId) return null")
    expect(source).toContain('!isAuthEntitlementTimeout(entitlementResult) && entitlementResult !== null')
    expect(source).toContain('? entitlementsRef.current')
    expect(source).toContain('if (!hasCurrentAccess) setAuthResolved(false)')
  })

  it('refreshes auth when a mobile browser restores or reconnects the page', () => {
    expect(source).toContain("document.addEventListener('visibilitychange', refreshVisiblePage)")
    expect(source).toContain("window.addEventListener('pageshow', refreshRestoredPage)")
    expect(source).toContain("window.addEventListener('online', refreshRestoredPage)")
    expect(source).toContain("window.removeEventListener('pageshow', refreshRestoredPage)")
  })
})
