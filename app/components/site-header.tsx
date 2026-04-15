'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BrandWordmark from '@/app/components/brand-wordmark'
import { useAuth } from '@/app/components/auth-provider'
import {
  transitionBase,
  hoverLift,
  hoverGlowGreen,
  hoverBrighten,
} from '@/lib/interaction-styles'
import { supabase } from '@/lib/supabase'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const LAST_ADMIN_IMPORT_ROUTE_STORAGE_KEY = 'tenaceiq-last-admin-import-route-v1'

const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
  { href: '/leagues', label: 'Leagues' },
]

function isActiveLink(active: string | undefined, pathname: string, href: string) {
  if (active) {
    if (active === href) return true
    if (href !== '/' && active.startsWith(href)) return true
  }

  if (pathname === href) return true
  if (href !== '/' && pathname.startsWith(href)) return true
  return false
}

const baseTextLink = {
  position: 'relative' as const,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '6px 4px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1,
  color: 'rgba(214,228,246,0.88)',
  whiteSpace: 'nowrap' as const,
  ...transitionBase,
}

const activeTextLink = {
  ...baseTextLink,
  color: '#f4f9ff',
}

const quietActionLink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 2px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1,
  color: 'rgba(222,233,247,0.76)',
  background: 'transparent',
  border: 'none',
  whiteSpace: 'nowrap' as const,
  ...transitionBase,
} as const

const ctaNavLink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.30)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: '#08111d',
  textDecoration: 'none',
  fontWeight: 900,
  fontSize: '14px',
  lineHeight: 1,
  letterSpacing: '-0.01em',
  boxShadow: '0 6px 14px rgba(155,225,29,0.10)',
  whiteSpace: 'nowrap' as const,
  ...transitionBase,
} as const

const mobilePanelLink = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minHeight: '50px',
  padding: '0 14px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'linear-gradient(180deg, rgba(14,31,60,0.56) 0%, rgba(8,19,38,0.76) 100%)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  ...transitionBase,
} as const

const mobilePanelLinkActive = {
  ...mobilePanelLink,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.08) 0%, rgba(20,39,74,0.78) 100%)',
  color: '#f4f9ff',
} as const

function HeaderLink({
  href,
  label,
  variant = 'nav',
  active = false,
  onClick,
}: {
  href: string
  label: string
  variant?: 'nav' | 'quiet' | 'cta'
  active?: boolean
  onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)

  if (variant === 'cta') {
    return (
      <Link
        href={href}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...ctaNavLink,
          ...(hovered ? { ...hoverLift, ...hoverGlowGreen, ...hoverBrighten } : {}),
        }}
      >
        {label}
      </Link>
    )
  }

  if (variant === 'quiet') {
    return (
      <Link
        href={href}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...quietActionLink,
          color: hovered ? '#f4f9ff' : quietActionLink.color,
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            paddingBottom: '3px',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              height: '2px',
              background:
                'linear-gradient(90deg, rgba(74,163,255,0.88) 0%, rgba(155,225,29,0.88) 100%)',
              transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
              transformOrigin: 'left center',
              transition: 'transform 180ms ease',
              opacity: hovered ? 0.9 : 0,
            }}
          />
          {label}
        </span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...(active ? activeTextLink : baseTextLink),
        color: hovered || active ? '#f4f9ff' : 'rgba(214,228,246,0.88)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          bottom: '3px',
          width: '100%',
          height: '2px',
          background:
            'linear-gradient(90deg, rgba(74,163,255,0.9) 0%, rgba(155,225,29,0.9) 100%)',
          transform: active || hovered ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left center',
          transition: 'transform 180ms ease',
          opacity: active || hovered ? 0.9 : 0,
        }}
      />
      {label}
    </Link>
  )
}

function HeaderButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '38px',
        padding: '0 2px',
        background: 'transparent',
        border: 'none',
        color: hovered ? '#f4f9ff' : 'rgba(222,233,247,0.76)',
        fontWeight: 700,
        fontSize: '14px',
        lineHeight: 1,
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        whiteSpace: 'nowrap',
        ...transitionBase,
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          paddingBottom: '3px',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: '2px',
            background:
              'linear-gradient(90deg, rgba(74,163,255,0.88) 0%, rgba(155,225,29,0.88) 100%)',
            transform: hovered ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left center',
            transition: 'transform 180ms ease',
            opacity: hovered ? 0.9 : 0,
          }}
        />
        {label}
      </span>
    </button>
  )
}

export default function SiteHeader({ active }: { active?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const [resumeImportHref, setResumeImportHref] = useState('/admin/import')
  const { isTablet, isMobile } = useViewportBreakpoints()

  useEffect(() => {
    if (typeof window === 'undefined' || role !== 'admin') return

    const savedHref = window.localStorage.getItem(LAST_ADMIN_IMPORT_ROUTE_STORAGE_KEY)
    if (savedHref) {
      setResumeImportHref(savedHref)
    }
  }, [pathname, role])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const headerPadding = isMobile ? '0 12px' : '0 16px'

  const headerInner = useMemo(
    () => ({
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      border: 'none',
      background: 'transparent',
      boxShadow: 'none',
      borderRadius: '0px',
      overflow: 'visible',
      position: 'relative' as const,
    }),
    [],
  )

  const topRow = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: isTablet ? 'minmax(0, 1fr) auto' : 'auto minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: isMobile ? '10px' : '18px',
      padding: isMobile ? '12px 6px' : '14px 4px',
      minHeight: isMobile ? '64px' : '70px',
      position: 'relative' as const,
      zIndex: 1,
    }),
    [isMobile, isTablet],
  )

  const navShell = useMemo(
    () => ({
      display: isTablet ? 'none' : 'flex',
      justifyContent: 'center' as const,
      minWidth: 0,
    }),
    [isTablet],
  )

  const navCluster = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    minWidth: 0,
  }

  const actionCluster = useMemo(
    () => ({
      display: isTablet ? 'none' : 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-end' as const,
      gap: '16px',
      minWidth: '182px',
    }),
    [isTablet],
  )

  const mobileToggleStyle = {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    border: '1px solid rgba(116,190,255,0.12)',
    background: 'linear-gradient(180deg, rgba(14,31,60,0.46) 0%, rgba(8,19,38,0.72) 100%)',
    color: '#F1F7FF',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    display: isTablet ? 'inline-flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    fontSize: '18px',
    ...transitionBase,
  } as const

  const mobilePanelStyle = {
    display: isTablet ? 'block' : 'none',
    maxHeight: menuOpen ? '760px' : '0px',
    opacity: menuOpen ? 1 : 0,
    overflow: 'hidden',
    transition: 'max-height 220ms ease, opacity 160ms ease',
    borderTop: menuOpen ? '1px solid rgba(116,190,255,0.08)' : '1px solid transparent',
    padding: menuOpen ? '0 0 12px' : '0',
    position: 'relative' as const,
    zIndex: 1,
  } as const

  const showAuthenticatedActions = role !== 'public'
  const showPublicActions = role === 'public'

  return (
    <header
      style={{
        position: 'relative',
        zIndex: 3,
        padding: headerPadding,
        borderBottom: '1px solid rgba(116,190,255,0.04)',
      }}
    >
      <div style={headerInner}>
        <div style={topRow}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              minWidth: 0,
              flexShrink: 0,
              width: 'fit-content',
            }}
            aria-label="TenAceIQ home"
          >
            <BrandWordmark top />
          </Link>

          <div style={navShell}>
            <nav style={navCluster} aria-label="Primary">
              {PRIMARY_LINKS.map((link) => {
                const activeNow = isActiveLink(active, pathname, link.href)
                return (
                  <HeaderLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    active={activeNow}
                  />
                )
              })}
            </nav>
          </div>

          <div style={actionCluster}>
            {showPublicActions ? (
              <>
                <HeaderLink href="/login" label="Login" variant="quiet" />
                <HeaderLink href="/join" label="Join" variant="cta" />
              </>
            ) : null}

            {showAuthenticatedActions ? (
              <>
                <HeaderLink href="/mylab" label="My Lab" variant="cta" />
                {role === 'admin' ? (
                  <>
                    <HeaderLink href={resumeImportHref} label="Resume import" variant="quiet" />
                    <HeaderLink href="/admin" label="Admin" variant="quiet" />
                  </>
                ) : null}
                <HeaderButton label="Logout" onClick={handleLogout} />
              </>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            style={mobileToggleStyle}
          >
            {menuOpen ? '×' : '☰'}
          </button>
        </div>

        <div style={mobilePanelStyle}>
          <nav style={{ display: 'grid', gap: '8px' }} aria-label="Mobile primary">
            {PRIMARY_LINKS.map((link) => {
              const activeNow = isActiveLink(active, pathname, link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={activeNow ? mobilePanelLinkActive : mobilePanelLink}
                >
                  <span>{link.label}</span>
                  <span style={{ opacity: activeNow ? 0.7 : 0.38 }}>→</span>
                </Link>
              )
            })}

            {showPublicActions ? (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} style={mobilePanelLink}>
                  <span>Login</span>
                  <span style={{ opacity: 0.38 }}>→</span>
                </Link>
                <Link
                  href="/join"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    ...mobilePanelLink,
                    ...ctaNavLink,
                    justifyContent: 'space-between',
                    width: '100%',
                    minHeight: '50px',
                    padding: '0 14px',
                    borderRadius: '16px',
                  }}
                >
                  <span>Join</span>
                  <span style={{ opacity: 0.62 }}>→</span>
                </Link>
              </>
            ) : null}

            {showAuthenticatedActions ? (
              <>
                <Link
                  href="/mylab"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    ...mobilePanelLink,
                    ...ctaNavLink,
                    justifyContent: 'space-between',
                    width: '100%',
                    minHeight: '50px',
                    padding: '0 14px',
                    borderRadius: '16px',
                  }}
                >
                  <span>My Lab</span>
                  <span style={{ opacity: 0.62 }}>→</span>
                </Link>
                {role === 'admin' ? (
                  <>
                    <Link href={resumeImportHref} onClick={() => setMenuOpen(false)} style={mobilePanelLink}>
                      <span>Resume import</span>
                      <span style={{ opacity: 0.38 }}>→</span>
                    </Link>
                    <Link href="/admin" onClick={() => setMenuOpen(false)} style={mobilePanelLink}>
                      <span>Admin</span>
                      <span style={{ opacity: 0.38 }}>→</span>
                    </Link>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    appearance: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    ...mobilePanelLink,
                  }}
                >
                  <span>Logout</span>
                  <span style={{ opacity: 0.38 }}>→</span>
                </button>
              </>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  )
}
