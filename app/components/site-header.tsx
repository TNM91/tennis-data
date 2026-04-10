'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BrandWordmark from '@/app/components/brand-wordmark'
import { supabase } from '@/lib/supabase'
import { normalizeUserRole, type UserRole } from '@/lib/roles'
import {
  transitionBase,
  hoverLift,
  hoverGlowBlue,
  hoverGlowGreen,
  hoverBrighten,
} from '@/lib/interaction-styles'

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

const basePill = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '16px',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '14px',
  lineHeight: 1,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  ...transitionBase,
} as const

const navLink = {
  ...basePill,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(26,54,104,0.22) 0%, rgba(12,28,57,0.22) 100%)',
  color: '#e7eefb',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
} as const

const activeNavLink = {
  ...basePill,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.12) 0%, rgba(37,91,227,0.18) 100%)',
  color: '#f6fbff',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 22px rgba(37,91,227,0.10), 0 0 0 1px rgba(155,225,29,0.06)',
} as const

const quietActionLink = {
  ...basePill,
  minHeight: '46px',
  padding: '0 18px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(24,50,96,0.18) 0%, rgba(12,27,54,0.18) 100%)',
  color: '#e7eefb',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
} as const

const ctaNavLink = {
  ...basePill,
  minHeight: '46px',
  padding: '0 20px',
  border: '1px solid rgba(155,225,29,0.30)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: '#08111d',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
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

  const base =
    variant === 'cta'
      ? ctaNavLink
      : variant === 'quiet'
        ? quietActionLink
        : active
          ? activeNavLink
          : navLink

  const hover =
    variant === 'cta'
      ? { ...hoverLift, ...hoverGlowGreen, ...hoverBrighten }
      : { ...hoverLift, ...hoverGlowBlue, ...hoverBrighten }

  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...base,
        ...(hovered ? hover : {}),
      }}
    >
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
        ...quietActionLink,
        ...(hovered ? { ...hoverLift, ...hoverGlowBlue, ...hoverBrighten } : {}),
      }}
    >
      {label}
    </button>
  )
}

async function loadProfileRole(userId: string | null | undefined): Promise<UserRole> {
  if (!userId) return 'public'

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return 'member'
    }

    return normalizeUserRole(data?.role ?? 'member')
  } catch {
    return 'member'
  }
}

export default function SiteHeader({ active }: { active?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const [screenWidth, setScreenWidth] = useState(1280)
  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      try {
        const { data, error } = await supabase.auth.getUser()

        if (!mounted) return

        if (error || !data.user) {
          setRole('public')
          return
        }

        const resolvedRole = await loadProfileRole(data.user.id)
        if (!mounted) return

        setRole(resolvedRole)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setRole('public')
        setAuthLoading(false)
        return
      }

      const resolvedRole = await loadProfileRole(session.user.id)
      setRole(resolvedRole)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname, screenWidth])

  async function handleLogout() {
    await supabase.auth.signOut()
    setRole('public')
    router.push('/')
    router.refresh()
  }

  const headerPadding = isMobile ? '10px 12px 0' : '12px 16px 0'

  const headerInner = useMemo(
    () => ({
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      borderRadius: isMobile ? '22px' : '26px',
      border: '1px solid rgba(116,190,255,0.12)',
      background: 'linear-gradient(180deg, rgba(13,31,62,0.94) 0%, rgba(8,19,37,0.98) 100%)',
      boxShadow:
        '0 16px 40px rgba(5,12,25,0.14), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 80px rgba(37,91,227,0.04)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      overflow: 'hidden',
      position: 'relative' as const,
    }),
    [isMobile],
  )

  const topRow = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: isTablet ? 'minmax(0, 1fr) auto' : 'auto minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: isMobile ? '10px' : '18px',
      padding: isMobile ? '10px 12px' : '12px 16px',
      minHeight: isMobile ? '68px' : '82px',
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
    gap: '8px',
    padding: '5px',
    borderRadius: '20px',
    border: '1px solid rgba(116,190,255,0.10)',
    background: 'linear-gradient(180deg, rgba(15,34,67,0.82) 0%, rgba(9,21,42,0.90) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
  }

  const actionCluster = useMemo(
    () => ({
      display: isTablet ? 'none' : 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-end' as const,
      gap: '10px',
      minWidth: '182px',
    }),
    [isTablet],
  )

  const mobileToggleStyle = {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    border: '1px solid rgba(116,190,255,0.16)',
    background: 'linear-gradient(180deg, rgba(26,54,104,0.20) 0%, rgba(12,28,57,0.20) 100%)',
    color: '#F1F7FF',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
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
    borderTop: menuOpen ? '1px solid rgba(116,190,255,0.10)' : '1px solid transparent',
    padding: menuOpen ? '0 12px 12px' : '0 12px',
    position: 'relative' as const,
    zIndex: 1,
  } as const

  const mobileLinkStyle = {
    ...navLink,
    width: '100%',
    justifyContent: 'space-between',
    minHeight: '50px',
    padding: '0 14px',
    borderRadius: '16px',
  } as const

  return (
    <header style={{ position: 'relative', zIndex: 3, padding: headerPadding }}>
      <div style={headerInner}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 0% 0%, rgba(74,163,255,0.10) 0%, transparent 30%), radial-gradient(circle at 100% 0%, rgba(155,225,29,0.08) 0%, transparent 24%)',
            pointerEvents: 'none',
          }}
        />

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
            {authLoading ? (
              <span style={{ ...quietActionLink, opacity: 0.72 }}>Loading...</span>
            ) : role === 'public' ? (
              <>
                <HeaderLink href="/login" label="Login" variant="quiet" />
                <HeaderLink href="/join" label="Join" variant="cta" />
              </>
            ) : (
              <>
                <HeaderLink href="/mylab" label="My Lab" variant="cta" />
                {role === 'admin' ? <HeaderLink href="/admin" label="Admin" variant="quiet" /> : null}
                <HeaderButton label="Logout" onClick={handleLogout} />
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            style={mobileToggleStyle}
          >
            ☰
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
                  style={{
                    ...(activeNow ? activeNavLink : mobileLinkStyle),
                    width: '100%',
                    justifyContent: 'space-between',
                    minHeight: '50px',
                    padding: '0 14px',
                    borderRadius: '16px',
                  }}
                >
                  <span>{link.label}</span>
                  <span style={{ opacity: activeNow ? 0.7 : 0.38 }}>→</span>
                </Link>
              )
            })}

            {authLoading ? (
              <span style={{ ...mobileLinkStyle, opacity: 0.72 }}>Loading...</span>
            ) : role === 'public' ? (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} style={mobileLinkStyle}>
                  <span>Login</span>
                  <span style={{ opacity: 0.38 }}>→</span>
                </Link>
                <Link
                  href="/join"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    ...mobileLinkStyle,
                    ...ctaNavLink,
                    borderRadius: '16px',
                  }}
                >
                  <span>Join</span>
                  <span style={{ opacity: 0.6 }}>→</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/mylab"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    ...mobileLinkStyle,
                    ...ctaNavLink,
                    borderRadius: '16px',
                  }}
                >
                  <span>My Lab</span>
                  <span style={{ opacity: 0.6 }}>→</span>
                </Link>
                {role === 'admin' ? (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} style={mobileLinkStyle}>
                    <span>Admin</span>
                    <span style={{ opacity: 0.38 }}>→</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    appearance: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    ...mobileLinkStyle,
                    borderRadius: '16px',
                  }}
                >
                  <span>Logout</span>
                  <span style={{ opacity: 0.38 }}>→</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}