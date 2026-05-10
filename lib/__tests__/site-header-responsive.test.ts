import { describe, expect, it } from 'vitest'
import {
  getSiteHeaderCompactBreakpoint,
  shouldUseCompactSiteHeader,
} from '../site-header-responsive'

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
})
