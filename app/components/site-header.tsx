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
      display: 'flex',
      justifyContent: 'space-between',
      flexDirection: isTablet ? ('column' as const) : ('row' as const),
      alignItems: isTablet ? ('flex-start' as const) : ('center' as const),
      gap: isTablet ? '16px' : '22px',
    }),
    [isTablet],
  )

  const navStyle = useMemo(
    () => ({
      display: 'flex',
      gap: '10px',
      width: isTablet ? '100%' : 'auto',
      justifyContent: isTablet ? ('flex-start' as const) : ('flex-end' as const),
      flexWrap: 'wrap' as const,
    }),
    [isTablet],
  )

  const navButtonReset = {
    ...navLink,
    cursor: 'pointer',
    appearance: 'none' as const,
  }

  return (
    <header style={{ position: 'relative', zIndex: 2, padding: headerPadding }}>
      <div style={headerInner}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          aria-label="TenAceIQ home"
        >
          <BrandWordmark compact={isMobile} top />
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

          <Link
            href="/leagues"
            style={{
              ...navLink,
              ...(isActiveLink(active, pathname, '/leagues') ? activeNavLink : {}),
            }}
          >
            Leagues
          </Link>

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
      </div>
    </header>
  )
}
