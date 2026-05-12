import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'lib/use-product-access.ts'), 'utf8')

describe('useProductAccess', () => {
  it('prefers the shared auth provider and only falls back when no provider is mounted', () => {
    expect(source).toContain("import { useOptionalAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('const auth = useOptionalAuth()')
    expect(source).toContain('if (auth) return')
    expect(source).toContain('getClientAuthState')
    expect(source).toContain('authResolved')
  })
})
