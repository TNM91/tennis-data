'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

type NavItem = {
  href: string
  label: string
}

const PUBLIC_NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
]

const MEMBER_MENU: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/my-players', label: 'My Players' },
  { href: '/my-teams', label: 'My Teams' },
  { href: '/my-leagues', label: 'My Leagues' },
  { href: '/profile', label: 'Profile' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<UserRole>('public')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return

      setRole(getUserRole(data.user?.id ?? null))
      setLoading(false)
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setRole(getUserRole(session?.user?.id ?? null))
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <header className="page-shell pt-5">
      <div className="site-header">
        <Link href="/" className="site-logo-link" aria-label="TenAceIQ home">
          <span className="site-logo-wordmark">TenAceIQ</span>
        </Link>

        <nav className="nav-row" aria-label="Primary">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive(pathname, item.href) ? 'nav-link-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/leagues"
            className={`nav-link ${isActive(pathname, '/leagues') ? 'nav-link-active' : ''}`}
          >
            Leagues
          </Link>
        </nav>

        <div className="nav-actions">
          {loading ? (
            <div className="button-secondary pointer-events-none opacity-70">
              Loading…
            </div>
          ) : role === 'public' ? (
            <>
              <Link href="/login" className="button-secondary">
                Login
              </Link>
              <Link href="/join" className="button-primary">
                Join
              </Link>
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                className="button-primary"
                onClick={() => setMenuOpen((value) => !value)}
              >
                My Lab
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[220px] rounded-2xl border border-white/12 bg-[rgba(11,18,32,0.96)] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <div className="flex flex-col gap-2">
                    {MEMBER_MENU.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="button-ghost justify-start text-sm"
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}

                    {role === 'admin' ? (
                      <Link
                        href="/admin"
                        className="button-ghost justify-start text-sm"
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      className="button-ghost justify-start text-sm"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}