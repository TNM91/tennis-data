'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ReactNode, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

const adminLinks = [
  { href: '/admin', label: 'Admin Home', description: 'Dashboard overview' },
  { href: '/admin/add-match', label: 'Add Match', description: 'Manual result entry' },
  { href: '/admin/manage-matches', label: 'Manage Matches', description: 'Search and delete results' },
  { href: '/admin/manage-players', label: 'Manage Players', description: 'Edit player records' },
  { href: '/admin/csv-import', label: 'CSV Import', description: 'Bulk upload results' },
  { href: '/admin/paste-results', label: 'Paste Results', description: 'Quick text import' },
  { href: '/admin/upload-scorecard', label: 'Upload Scorecard', description: 'Parse league scorecards' },
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
                Verifying administrator credentials and preparing your control center.
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

  const showShell = authorized && pathname !== '/admin'

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

      {!showShell ? (
        <main className="page-shell" style={{ flex: 1 }}>
          {children}
        </main>
      ) : (
        <main
          style={{
            width: 'min(1400px, calc(100% - 24px))',
            margin: '0 auto',
            padding: '24px 0 56px',
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '280px minmax(0, 1fr)',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          <aside
            className="glass-card"
            style={{
              position: 'sticky',
              top: '96px',
              padding: '18px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                paddingBottom: '14px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '999px',
                  background: 'rgba(155,225,29,0.14)',
                  border: '1px solid rgba(155,225,29,0.24)',
                  color: '#d9ff9f',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Control Center
              </div>

              <h2
                style={{
                  margin: '14px 0 0 0',
                  color: '#ffffff',
                  fontSize: '1.35rem',
                  fontWeight: 850,
                  letterSpacing: '-0.03em',
                }}
              >
                Admin Workspace
              </h2>

              <p
                className="dark-subtle-text"
                style={{
                  marginTop: '10px',
                  marginBottom: 0,
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                }}
              >
                Manage players, import data, and keep match records clean and current.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '10px',
              }}
            >
              {adminLinks.map((link) => {
                const active = pathname === link.href

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      borderRadius: '18px',
                      padding: '14px 14px',
                      border: active
                        ? '1px solid rgba(155,225,29,0.34)'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: active
                        ? 'linear-gradient(135deg, rgba(155,225,29,0.96), rgba(199,243,107,0.96))'
                        : 'rgba(255,255,255,0.04)',
                      color: active ? '#08111d' : '#ffffff',
                      boxShadow: active
                        ? '0 10px 28px rgba(155,225,29,0.16)'
                        : 'none',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.98rem',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {link.label}
                    </div>
                    <div
                      style={{
                        marginTop: '5px',
                        fontSize: '0.84rem',
                        color: active ? 'rgba(8,17,29,0.72)' : 'rgba(229,238,251,0.68)',
                      }}
                    >
                      {link.description}
                    </div>
                  </Link>
                )
              })}
            </div>
          </aside>

          <section style={{ minWidth: 0 }}>
            <section className="hero-panel" style={{ marginBottom: '24px' }}>
              <div className="hero-inner">
                <div className="section-kicker">TenAceIQ Admin</div>
                <h1 className="page-title">Operations Dashboard</h1>
                <p className="page-subtitle">
                  Manage player data, import results, maintain matches, and keep the
                  platform up to date from one streamlined workspace.
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginTop: '20px',
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
                          minHeight: '40px',
                          padding: '0 14px',
                          borderRadius: '999px',
                          textDecoration: 'none',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          border: active
                            ? '1px solid rgba(155,225,29,0.34)'
                            : '1px solid rgba(255,255,255,0.14)',
                          background: active
                            ? 'linear-gradient(135deg, #9be11d, #c7f36b)'
                            : 'rgba(255,255,255,0.07)',
                          color: active ? '#08111d' : '#ffffff',
                        }}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </section>

            <div>{children}</div>
          </section>
        </main>
      )}

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

      <style jsx>{`
        @media (max-width: 1024px) {
          main[style*='grid-template-columns: 280px minmax(0, 1fr)'] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}