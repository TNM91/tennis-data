'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ReactNode, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

const adminLinks = [
  { href: '/admin', label: 'Admin Home' },
  { href: '/admin/add-match', label: 'Add Match' },
  { href: '/admin/manage-matches', label: 'Manage Matches' },
  { href: '/admin/manage-players', label: 'Manage Players' },
  { href: '/admin/csv-import', label: 'CSV Import' },
  { href: '/admin/paste-results', label: 'Paste Results' },
  { href: '/admin/upload-scorecard', label: 'Upload Scorecard' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const isAdmin = user?.id === ADMIN_ID

      setAuthorized(isAdmin)
      setLoading(false)

      if (!isAdmin && pathname !== '/admin') {
        router.push('/admin')
      }
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const isAdmin = session?.user?.id === ADMIN_ID
      setAuthorized(isAdmin)
      setLoading(false)

      if (!isAdmin && pathname !== '/admin') {
        router.push('/admin')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, pathname])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header className="top-nav">
          <div className="top-nav-inner">
            <Link href="/" className="brand-lockup">
              <Image
                src="/logo-icon.png"
                alt="TenAceIQ"
                width={42}
                height={42}
                className="brand-mark"
              />
              <span className="brand-wordmark">TenAceIQ</span>
            </Link>
          </div>
        </header>

        <main className="page-shell">
          <section className="hero-panel">
            <div className="hero-inner">
              <div className="section-kicker">Admin Access</div>
              <h1 className="page-title">Checking access...</h1>
              <p className="page-subtitle">
                Verifying administrator credentials and preparing your control
                center.
              </p>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!authorized && pathname !== '/admin') {
    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header className="top-nav">
        <div className="top-nav-inner" style={{ flexWrap: 'wrap', paddingBlock: '12px' }}>
          <Link href="/" className="brand-lockup">
            <Image
              src="/logo-icon.png"
              alt="TenAceIQ"
              width={42}
              height={42}
              className="brand-mark"
            />
            <span className="brand-wordmark">TenAceIQ</span>
          </Link>

          <nav
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <Link
              href="/"
              className="badge badge-slate"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              Back to Site
            </Link>

            {authorized && (
              <Link
                href="/admin"
                className="badge badge-green"
                style={{
                  textDecoration: 'none',
                }}
              >
                Admin Mode
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="page-shell" style={{ flex: 1 }}>
        {authorized && pathname !== '/admin' && (
          <section className="hero-panel" style={{ marginBottom: '24px' }}>
            <div className="hero-inner">
              <div className="section-kicker">Control Center</div>
              <h1 className="page-title">TenAceIQ Admin</h1>
              <p className="page-subtitle">
                Manage player data, import results, maintain matches, and keep
                the platform up to date from one streamlined workspace.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginTop: '22px',
                }}
              >
                {adminLinks.map((link) => {
                  const active = pathname === link.href
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '42px',
                        padding: '0 16px',
                        borderRadius: '999px',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        textDecoration: 'none',
                        transition: 'all 0.18s ease',
                        border: active
                          ? '1px solid rgba(155,225,29,0.34)'
                          : '1px solid rgba(255,255,255,0.14)',
                        background: active
                          ? 'linear-gradient(135deg, #9be11d, #c7f36b)'
                          : 'rgba(255,255,255,0.07)',
                        color: active ? '#08111d' : '#ffffff',
                        boxShadow: active
                          ? '0 0 0 1px rgba(155,225,29,0.18), 0 10px 30px rgba(155,225,29,0.12)'
                          : 'none',
                      }}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        <div>{children}</div>
      </main>

      <footer className="footer-shell">
        <div className="footer-inner">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 800, color: '#081a31' }}>TenAceIQ Admin</div>
            <div className="footer-copy">
              Internal tools for managing ratings, matches, imports, and captain workflows.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}