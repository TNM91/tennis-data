import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/upgrade-prompt.tsx'), 'utf8')

describe('upgrade prompt access loading', () => {
  it('does not show a paid offer while a signed-in entitlement snapshot is unresolved', () => {
    expect(source).toContain('const accessPending = isSignedIn && (!authResolved || entitlements === null)')
    expect(source).toContain('if (accessPending || alreadyHasPlan) return null')
    expect(source.indexOf('const accessPending')).toBeLessThan(source.indexOf('if (accessPending || alreadyHasPlan)'))
  })
})
