import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getSiteHeaderCompactBreakpoint,
  shouldUseCompactSiteHeader,
} from '../site-header-responsive'

const siteHeaderSource = readFileSync(join(process.cwd(), 'app/components/site-header.tsx'), 'utf8')

describe('site header responsive rules', () => {
  it('compresses admin navigation earlier to protect pricing and account controls', () => {
    expect(getSiteHeaderCompactBreakpoint('admin', true)).toBe(1680)
    expect(shouldUseCompactSiteHeader({ role: 'admin', authenticated: true, screenWidth: 1440 })).toBe(true)
    expect(shouldUseCompactSiteHeader({ role: 'admin', authenticated: true, screenWidth: 1600 })).toBe(true)
    expect(shouldUseCompactSiteHeader({ role: 'admin', authenticated: true, screenWidth: 1720 })).toBe(false)
  })

  it('keeps member and public breakpoints less aggressive', () => {
    expect(getSiteHeaderCompactBreakpoint('member', true)).toBe(1480)
    expect(getSiteHeaderCompactBreakpoint('public', false)).toBe(1200)
    expect(shouldUseCompactSiteHeader({ role: 'captain', authenticated: true, screenWidth: 1440 })).toBe(true)
    expect(shouldUseCompactSiteHeader({ role: 'captain', authenticated: true, screenWidth: 1520 })).toBe(false)
    expect(shouldUseCompactSiteHeader({ role: 'public', authenticated: false, screenWidth: 1100 })).toBe(true)
  })

  it('does not show public account CTAs while auth is still resolving', () => {
    expect(siteHeaderSource).toContain('const authPending = !authResolved')
    expect(siteHeaderSource).toContain("authPending ? (")
    expect(siteHeaderSource).toContain('const navPendingStyle')
    expect(siteHeaderSource).toContain('Checking access')
    expect(siteHeaderSource).toContain('{authPending ? null : authenticated ? (')
  })
})
