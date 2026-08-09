import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { shouldUseFocusedSiteShell } from '../site-shell-focus'

const login = readFileSync(join(process.cwd(), 'app/login/page.tsx'), 'utf8')
const joinPage = readFileSync(join(process.cwd(), 'app/join/page.tsx'), 'utf8')

describe('focused auth and admin shell', () => {
  it('removes the marketing footer and portal interruptions from focused routes', () => {
    expect(shouldUseFocusedSiteShell('/login')).toBe(true)
    expect(shouldUseFocusedSiteShell('/join')).toBe(true)
    expect(shouldUseFocusedSiteShell('/admin/clubs')).toBe(true)
    expect(shouldUseFocusedSiteShell('/captain')).toBe(false)
  })

  it('keeps login and registration direct', () => {
    expect(login).toContain('Sign in to TenAceIQ.')
    expect(login).toContain('Explore without signing in')
    expect(login).not.toContain('More Tennis. Less Chaos.</div>')
    expect(joinPage).toContain('Create your free account.')
    expect(joinPage).not.toContain('<TiqFeatureIcon name="accountSecurity"')
  })
})
