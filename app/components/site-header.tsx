'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BrandWordmark from '@/app/components/brand-wordmark'
import { useAuth } from '@/app/components/auth-provider'
import { useTheme } from '@/app/components/theme-provider'
import { PRIMARY_NAV_ITEMS } from '@/lib/site-navigation'
import { supabase } from '@/lib/supabase'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const LAST_ADMIN_IMPORT_ROUTE_STORAGE_KEY = 'tenaceiq-last-admin-import-route-v1'

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.2v2M10 15.8v2M17.8 10h-2M4.2 10h-2M15.6 4.4l-1.5 1.5M5.9 14.1l-1.5 1.5M15.6 15.6l-1.5-1.5M5.9 5.9 4.4 4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M14.9 12.9A6.5 6.5 0 0 1 7.1 5.1a7 7 0 1 0 7.8 7.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function normalizeRouteKey(value: string | undefined) {
  if (!value) return ''
  if (value === '/') return value
  return value.startsWith('/') ? value : `/${value}`
}

function isActiveLink(active: string | undefined, pathname: string, href: string) {
  const normalizedActive = normalizeRouteKey(active)

  if (normalizedActive) {
    if (normalizedActive === href) return true
    if (href !== '/' && normalizedActive.startsWith(href)) return true
  }

  if (pathname === href) return true
  if (href !== '/' && pathname.startsWith(href)) return true
  return false
}

function ThemeToggle({
  compact = false,
  onClick,
  theme,
}: {
  compact?: boolean
  onClick: () => void
  theme: 'dark' | 'light'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '0' : '8px',
        minWidth: compact ? '40px' : 'auto',
        minHeight: compact ? '40px' : '38px',
        padding: compact ? '0' : '0 11px',
        borderRadius: compact ? '13px' : '999px',
        border: '1px solid rgba(116,190,255,0.10)',
        background: 'color-mix(in srgb, var(--header-bg) 78%, var(--surface) 22%)',
        color: 'var(--foreground-strong)',
        fontWeight: 750,
        fontSize: '12px',
        letterSpacing: '-0.01em',
        cursor: 'pointer',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        transition: 'transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease',
      }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      {compact ? null : <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

function HeaderNavLink({
  href,
  label,
  activeNow,
}: {
  href: string
  label: string
  activeNow: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      aria-current={activeNow ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...navLinkStyle,
        border: activeNow
          ? '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)'
          : hovered
            ? '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)'
            : '1px solid transparent',
        color: activeNow || hovered ? 'var(--foreground-strong)' : 'var(--header-link)',
        background: activeNow
          ? 'color-mix(in srgb, var(--brand-green) 12%, transparent 88%)'
          : hovered
            ? 'color-mix(in srgb, var(--brand-blue-2) 10%, transparent 90%)'
            : 'transparent',
        boxShadow: hovered
          ? '0 8px 20px rgba(37, 91, 227, 0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
          : 'none',
      }}
    >
      <span>{label}</span>
      {activeNow ? <span aria-hidden="true" style={activeDotStyle} /> : null}
    </Link>
  )
}

function UtilityLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...utilityLinkStyle,
        color: hovered ? 'var(--foreground-strong)' : utilityLinkStyle.color,
        background: hovered ? 'color-mix(in srgb, var(--brand-blue-2) 9%, transparent 91%)' : utilityLinkStyle.background,
      }}
    >
      {children}
    </Link>
  )
}

export default function SiteHeader({ active }: { active?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { isTablet, isMobile } = useViewportBreakpoints()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close mobile menu whenever the route changes (back/forward navigation)
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const resumeImportHref = useMemo(() => {
    if (typeof window === 'undefined' || role !== 'admin') return '/admin/import'
    return window.localStorage.getItem(LAST_ADMIN_IMPORT_ROUTE_STORAGE_KEY) ?? '/admin/import'
  }, [role])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const authenticated = role !== 'public'
  const useCompactBrand = isTablet
  const roleLabel = role === 'admin' ? 'Admin' : role === 'captain' ? 'Captain' : authenticated ? 'Member' : ''

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        overflow: 'clip',
        padding: `max(0px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))`,
        background: 'transparent',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'var(--header-bg)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          bottom: -24,
          height: 56,
          pointerEvents: 'none',
          background: 'var(--header-fade)',
          filter: 'blur(18px)',
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: isMobile ? '8px 2px' : isTablet ? '10px 4px' : '11px 8px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isTablet ? 'minmax(0, 1fr) auto' : 'auto minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: isMobile ? '10px' : isTablet ? '12px' : '16px',
            padding: isMobile ? '6px 6px' : isTablet ? '7px 8px' : '8px 10px',
            borderRadius: isMobile ? 18 : 999,
            border: '1px solid color-mix(in srgb, var(--shell-panel-border) 76%, rgba(116,190,255,0.18) 24%)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--header-bg) 86%, var(--surface) 14%) 0%, color-mix(in srgb, var(--header-bg) 94%, transparent 6%) 100%)',
            boxShadow: '0 14px 34px rgba(2, 10, 24, 0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <Link
            href="/"
            aria-label="TenAceIQ home"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              width: 'fit-content',
              minWidth: 0,
              textDecoration: 'none',
            }}
          >
            <BrandWordmark top={!useCompactBrand} compact={useCompactBrand} />
          </Link>

          {isTablet ? null : (
            <nav
              aria-label="Primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                minWidth: 0,
                paddingInline: '6px',
              }}
            >
              {PRIMARY_NAV_ITEMS.map((item) => {
                const activeNow = isActiveLink(active, pathname, item.href)
                return (
                  <HeaderNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    activeNow={activeNow}
                  />
                )
              })}
            </nav>
          )}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: isMobile ? '7px' : isTablet ? '8px' : '9px',
            }}
          >
            {isTablet ? null : <ThemeToggle onClick={toggleTheme} theme={theme} />}

            {isTablet ? null : authenticated ? (
              <>
                {roleLabel ? <span style={accountPillStyle}>{roleLabel}</span> : null}
                {role === 'admin' ? (
                  <>
                    <UtilityLink href="/admin">Admin dashboard</UtilityLink>
                    <UtilityLink href={resumeImportHref}>Resume import</UtilityLink>
                  </>
                ) : null}
                <button type="button" onClick={handleLogout} style={utilityButtonStyle}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <UtilityLink href="/login">Sign in</UtilityLink>
                <Link href="/join" style={primaryCtaStyle}>
                  Start Free
                </Link>
              </>
            )}

            {isTablet ? (
              <button
                type="button"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
                style={menuButtonStyle}
              >
                {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
              </button>
            ) : null}
          </div>
        </div>

        {isTablet ? (
          <div
            style={{
              maxHeight: menuOpen ? '760px' : '0px',
              opacity: menuOpen ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 220ms ease, opacity 180ms ease',
            }}
          >
            <div
              style={{
                marginTop: '10px',
                border: '1px solid color-mix(in srgb, var(--shell-panel-border) 78%, rgba(116,190,255,0.16) 22%)',
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-bg) 96%, var(--surface) 4%) 0%, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--surface-soft) 8%) 100%)',
                borderRadius: '20px',
                padding: '12px',
                boxShadow: 'var(--shadow-card)',
                display: 'grid',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingBottom: '2px' }}>
                <div style={mobileSectionLabelStyle}>{roleLabel ? `${roleLabel} navigation` : 'Navigation'}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {roleLabel ? <span style={accountPillStyle}>{roleLabel}</span> : null}
                  <ThemeToggle compact onClick={toggleTheme} theme={theme} />
                </div>
              </div>

              {PRIMARY_NAV_ITEMS.map((item) => {
                const activeNow = isActiveLink(active, pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={activeNow ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      ...mobileItemStyle,
                      borderColor: activeNow ? 'rgba(155, 225, 29, 0.30)' : 'var(--shell-panel-border)',
                      background: activeNow
                        ? 'linear-gradient(180deg, color-mix(in srgb, var(--shell-chip-bg-strong) 72%, var(--surface) 28%) 0%, var(--shell-chip-bg-strong) 100%)'
                        : 'linear-gradient(180deg, color-mix(in srgb, var(--shell-chip-bg) 90%, var(--surface) 10%) 0%, var(--shell-chip-bg) 100%)',
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                  </Link>
                )
              })}

              {authenticated ? (
                <>
                  {role === 'admin' ? (
                    <>
                      <Link href="/admin" onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                        <span>Admin dashboard</span>
                        <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                      </Link>
                      <Link href={resumeImportHref} onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                        <span>Resume import</span>
                        <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                      </Link>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      ...mobileItemStyle,
                      cursor: 'pointer',
                    }}
                  >
                    <span>Logout</span>
                    <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                    <span>Sign in</span>
                    <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                  </Link>
                  <Link
                    href="/join"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      ...mobileItemStyle,
                      ...primaryCtaStyle,
                      minHeight: '52px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Start Free</span>
                    <span style={{ opacity: 0.62 }}>{'\u2192'}</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  )
}

const utilityLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 8px',
  borderRadius: '999px',
  border: 'none',
  color: 'var(--header-link)',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  textDecoration: 'none',
  background: 'transparent',
} as const

const navLinkStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 13px',
  borderRadius: '999px',
  fontSize: '13px',
  fontWeight: 750,
  letterSpacing: '-0.015em',
  textDecoration: 'none',
  transition: 'border-color 160ms ease, color 160ms ease, background 160ms ease',
} as const

const accountPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 10px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  whiteSpace: 'nowrap' as const,
} as const

const activeDotStyle = {
  position: 'absolute',
  left: '50%',
  bottom: '5px',
  width: '4px',
  height: '4px',
  borderRadius: '999px',
  transform: 'translateX(-50%)',
  background: 'var(--brand-green)',
  boxShadow: '0 0 10px rgba(155, 225, 29, 0.55)',
} as const

const utilityButtonStyle = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 8px',
  borderRadius: '999px',
  color: 'var(--header-link)',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
} as const

const primaryCtaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 18px',
  borderRadius: '999px',
  border: '1px solid rgba(155, 225, 29, 0.32)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: 'var(--text-dark)',
  fontSize: '13px',
  fontWeight: 900,
  letterSpacing: '-0.02em',
  textDecoration: 'none',
  boxShadow: '0 12px 24px rgba(155, 225, 29, 0.18), inset 0 1px 0 rgba(255,255,255,0.28)',
} as const

const menuButtonStyle = {
  width: '40px',
  height: '40px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '13px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 82%, transparent 18%)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
} as const

const mobileItemStyle = {
  minHeight: '48px',
  padding: '0 14px',
  borderRadius: '15px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
} as const

const mobileSectionLabelStyle = {
  color: 'var(--muted-strong)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
} as const
