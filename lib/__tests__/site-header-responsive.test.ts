import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getSiteHeaderCompactBreakpoint,
  shouldUseCompactSiteHeader,
} from '../site-header-responsive'

const siteHeaderSource = readFileSync(join(process.cwd(), 'app/components/site-header.tsx'), 'utf8')

describe('site header responsive rules', () => {
  it('keeps breakpoint constants documented for future wide-header tuning', () => {
    expect(getSiteHeaderCompactBreakpoint('admin', true)).toBe(1680)
    expect(getSiteHeaderCompactBreakpoint('member', true)).toBe(1480)
    expect(getSiteHeaderCompactBreakpoint('public', false)).toBe(1200)
  })

  it('uses the full action nav when the viewport can support it', () => {
    expect(shouldUseCompactSiteHeader({ role: 'admin', authenticated: true, screenWidth: 1720 })).toBe(false)
    expect(shouldUseCompactSiteHeader({ role: 'captain', authenticated: true, screenWidth: 1440 })).toBe(true)
    expect(shouldUseCompactSiteHeader({ role: 'captain', authenticated: true, screenWidth: 1520 })).toBe(false)
    expect(shouldUseCompactSiteHeader({ role: 'public', authenticated: false, screenWidth: 1100 })).toBe(true)
    expect(shouldUseCompactSiteHeader({ role: 'public', authenticated: false, screenWidth: 1280 })).toBe(false)
  })

  it('does not show public account CTAs while auth is still resolving', () => {
    expect(siteHeaderSource).toContain('const authPending = !authResolved')
    expect(siteHeaderSource).toContain("authPending ? (")
    expect(siteHeaderSource).toContain('Checking access')
    expect(siteHeaderSource).toContain('{authPending ? null : authenticated ? (')
  })

  it('labels League plan access as League instead of Coordinator', () => {
    expect(siteHeaderSource).toContain("access.currentPlanId === 'league'")
    expect(siteHeaderSource).toContain("? 'League'")
    expect(siteHeaderSource).not.toContain("? 'Coordinator'")
  })

  it('adds one role-aware workspace shortcut for signed-in users', () => {
    expect(siteHeaderSource).toContain('function getHeaderWorkspaceShortcut')
    expect(siteHeaderSource).toContain("if (access.canUseLeagueTools) return { href: '/league-coordinator', label: 'League Office' }")
    expect(siteHeaderSource).toContain("if (access.canUseCaptainWorkflow) return { href: '/captain', label: 'Team Hub' }")
    expect(siteHeaderSource).toContain("if (access.canUseCoachWorkflow) return { href: '/coach', label: 'Coach Hub' }")
    expect(siteHeaderSource).toContain("if (access.canUseAdvancedPlayerInsights) return { href: '/mylab', label: 'My Lab' }")
    expect(siteHeaderSource).toContain("return { href: '/explore', label: 'Find tennis' }")
    expect(siteHeaderSource).toContain('const workspaceShortcut = getHeaderWorkspaceShortcut(access, authenticated)')
    expect(siteHeaderSource).toContain('const workspaceShortcutStyle')
    expect(siteHeaderSource).toContain('const mobileWorkspaceItemStyle')
  })

  it('keeps shared header controls readable across themes', () => {
    expect(siteHeaderSource).toContain('const primaryCtaStyle')
    expect(siteHeaderSource).toContain('const utilityButtonStyle')
    expect(siteHeaderSource).toContain('const headerSearchPanelStyle')
    expect(siteHeaderSource).toContain('const mobileSearchWrapStyle')
    expect(siteHeaderSource).toContain("accessPending ? 'Account' : authenticated ? roleLabel || 'Account' : 'Menu'")
    expect(siteHeaderSource).toContain("background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'")
    expect(siteHeaderSource).toContain("color: 'var(--foreground-strong)'")
    expect(siteHeaderSource).not.toContain("background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-3))',\n  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',\n  color: 'var(--text-dark)'")
    expect(siteHeaderSource).not.toContain("background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',\n  color: 'var(--text-dark)'")
  })

  it('keeps the compact phone header short enough for the sticky portal', () => {
    expect(siteHeaderSource).toContain("padding: isMobile ? '5px 2px'")
    expect(siteHeaderSource).toContain("padding: isMobile ? '5px 6px'")
    expect(siteHeaderSource).toContain("width: '36px'")
    expect(siteHeaderSource).toContain("height: '36px'")
    expect(readFileSync(join(process.cwd(), 'app/components/brand-wordmark.tsx'), 'utf8')).toContain(
      'top ? (siteHeaderCompact ? 42 : 64)',
    )
  })

  it('puts universal search in the header and compact menu', () => {
    expect(siteHeaderSource).toContain("import UniversalSearch from '@/app/components/universal-search'")
    expect(siteHeaderSource).toContain('aria-controls="site-header-search-panel"')
    expect(siteHeaderSource).toContain('aria-haspopup="dialog"')
    expect(siteHeaderSource).toContain("aria-label={searchOpen ? 'Close site search' : 'Open site search'}")
    expect(siteHeaderSource).toContain('role="dialog"')
    expect(siteHeaderSource).toContain('aria-modal="false"')
    expect(siteHeaderSource).toContain('aria-labelledby="site-header-search-title"')
    expect(siteHeaderSource).toContain('aria-label="Close site search"')
    expect(siteHeaderSource).toContain("event.key === 'Escape'")
    expect(siteHeaderSource).toContain('const headerSearchPanelHeaderStyle')
    expect(siteHeaderSource).toContain('const searchCloseButtonStyle')
    expect(siteHeaderSource).toContain('<UniversalSearch compact placeholder="Search TenAceIQ" showResults={false} />')
  })
})
