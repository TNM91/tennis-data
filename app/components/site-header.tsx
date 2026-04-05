'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BrandWordmark from '@/app/components/brand-wordmark'
import { supabase } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

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

const navLink = {
  padding: '11px 17px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(40,82,150,0.26) 0%, rgba(18,40,78,0.24) 100%)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '14px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
} as const

const ctaNavLink = {
  ...navLink,
  color: '#08111d',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
} as const

const activeNavLink = {
  ...ctaNavLink,
} as const

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
        const { data } = await supabase.auth.getUser()
        if (!mounted) return
        setRole(getUserRole(data.user?.id ?? null))
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setRole(getUserRole(session?.user?.id ?? null))
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
    router.push('/')
    router.refresh()
  }

  const headerPadding = isMobile ? '18px 16px 0' : '18px 24px 0'

  const headerInner = useMemo(
    () => ({
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      borderRadius: '24px',
      border: '1px solid rgba(116,190,255,0.14)',
      background: 'linear-gradient(180deg, rgba(18,36,68,0.88) 0%, rgba(10,20,38,0.94) 100%)',
      boxShadow: '0 20px 50px rgba(5,12,25,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      overflow: 'hidden',
    }),
    [],
  )

  const topRow = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: isMobile ? '14px 14px' : '16px 18px',
      minHeight: isMobile ? '78px' : '88px',
    }),
    [isMobile],
  )

  const navStyle = useMemo(
    () => ({
      display: isTablet ? 'none' : 'flex',
      gap: '10px',
      justifyContent: 'flex-end' as const,
      flexWrap: 'wrap' as const,
      alignItems: 'center',
    }),
    [isTablet],
  )

  const navButtonReset = {
    ...navLink,
    cursor: 'pointer',
    appearance: 'none' as const,
    fontFamily: 'inherit',
  }

  const mobileToggleStyle = {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    border: '1px solid rgba(116,190,255,0.18)',
    background: 'linear-gradient(180deg, rgba(40,82,150,0.26) 0%, rgba(18,40,78,0.24) 100%)',
    color: '#F1F7FF',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
    display: isTablet ? 'inline-flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as const

  const mobilePanelStyle = {
    display: isTablet ? 'block' : 'none',
    maxHeight: menuOpen ? '720px' : '0px',
    opacity: menuOpen ? 1 : 0,
    overflow: 'hidden',
    transition: 'max-height 220ms ease, opacity 160ms ease',
    borderTop: menuOpen ? '1px solid rgba(116,190,255,0.10)' : '1px solid transparent',
    padding: menuOpen ? '12px 14px 14px' : '0 14px',
  } as const

  const mobileLinkStyle = {
    ...navLink,
    width: '100%',
    justifyContent: 'space-between',
    minHeight: '52px',
    padding: '0 16px',
    borderRadius: '16px',
  } as const

  return (
    <header style={{ position: 'relative', zIndex: 2, padding: headerPadding }}>
      <div style={headerInner}>
        <div style={topRow}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              minWidth: 0,
              flexShrink: 1,
            }}
            aria-label="TenAceIQ home"
          >
            <BrandWordmark top compact={false} />
          </Link>

          <nav style={navStyle} aria-label="Primary">
            {PRIMARY_LINKS.map((link) => {
              const activeNow = isActiveLink(active, pathname, link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    ...navLink,
                    ...(activeNow ? activeNavLink : {}),
                  }}
                >
                  {link.label}
                </Link>
              )
            })}

            {authLoading ? (
              <span style={{ ...navLink, opacity: 0.72 }}>Loading...</span>
            ) : role === 'public' ? (
              <>
                <Link href="/login" style={navLink}>
                  Login
                </Link>
                <Link href="/join" style={ctaNavLink}>
                  Join
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" style={ctaNavLink}>
                  My Lab
                </Link>
                {role === 'admin' ? (
                  <Link href="/admin" style={navLink}>
                    Admin
                  </Link>
                ) : null}
                <button type="button" onClick={handleLogout} style={navButtonReset}>
                  Logout
                </button>
              </>
            )}
          </nav>

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
          <nav style={{ display: 'grid', gap: '10px' }} aria-label="Mobile primary">
            {PRIMARY_LINKS.map((link) => {
              const activeNow = isActiveLink(active, pathname, link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    ...mobileLinkStyle,
                    ...(activeNow ? activeNavLink : {}),
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
                  href="/dashboard"
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
                    ...mobileLinkStyle,
                    ...navButtonReset,
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