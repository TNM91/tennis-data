'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      setAuthLoading(false)
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = user?.id === ADMIN_ID

  async function handleSendMagicLink() {
    setError('')
    setMessage('')

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Enter your email.')
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: 'https://tennis-data-eosin.vercel.app/admin',
      },
    })

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Magic link sent. Check your email.')
  }

  async function handleLogout() {
    setError('')
    setMessage('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    setUser(null)
    setMessage('Logged out successfully.')
  }

  if (authLoading) {
    return (
      <main className="page-shell-tight">
        <section className="hero-panel">
          <div className="hero-inner">
            <div className="section-kicker">Admin Access</div>
            <h1 className="page-title">Checking access...</h1>
            <p className="page-subtitle">
              Verifying your credentials and preparing the control center.
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell-tight">
      {/* HERO */}
      <section className="hero-panel">
        <div className="hero-inner">
          <div className="section-kicker">Admin</div>
          <h1 className="page-title">Control Center</h1>
          <p className="page-subtitle">
            Secure tools for managing matches, imports, players, and platform data.
          </p>
        </div>
      </section>

      {/* NOT LOGGED IN */}
      {!user && (
        <section className="surface-card panel-pad section">
          <h2 className="section-title">Admin Login</h2>
          <p className="subtle-text" style={{ marginTop: 8 }}>
            Sign in with your admin email to access protected tools.
          </p>

          <div style={{ marginTop: 16 }}>
            <label className="label">Email</label>
            <input
              type="email"
              placeholder="Your admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <button onClick={handleSendMagicLink} className="button-primary">
              Send Magic Link
            </button>
          </div>

          {message && (
            <div className="badge badge-green" style={{ marginTop: 16 }}>
              {message}
            </div>
          )}

          {error && (
            <div
              className="badge"
              style={{
                marginTop: 16,
                background: 'rgba(220,38,38,0.12)',
                color: '#7f1d1d',
                border: '1px solid rgba(220,38,38,0.2)',
              }}
            >
              {error}
            </div>
          )}
        </section>
      )}

      {/* NOT AUTHORIZED */}
      {user && !isAdmin && (
        <section className="surface-card panel-pad section">
          <h2 className="section-title">Not Authorized</h2>
          <p className="subtle-text" style={{ marginTop: 8 }}>
            You are logged in, but this account does not have admin access.
          </p>

          <div style={{ marginTop: 18 }}>
            <button onClick={handleLogout} className="button-secondary">
              Logout
            </button>
          </div>
        </section>
      )}

      {/* ADMIN DASHBOARD */}
      {user && isAdmin && (
        <>
          {/* STATS */}
          <div className="metric-grid section">
            <div className="metric-card">
              <div className="metric-label">Status</div>
              <div className="metric-value">Admin</div>
              <div className="metric-help">Full system access</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Tools</div>
              <div className="metric-value">6</div>
              <div className="metric-help">Available modules</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Session</div>
              <div className="metric-value">Active</div>
              <div className="metric-help">Authenticated</div>
            </div>
          </div>

          {/* ACCOUNT */}
          <section className="surface-card panel-pad section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 className="section-title">Admin Panel</h2>
                <p className="subtle-text" style={{ marginTop: 8 }}>
                  Logged in as <strong>{user.email}</strong>
                </p>
              </div>

              <button onClick={handleLogout} className="button-secondary">
                Logout
              </button>
            </div>

            {message && (
              <div className="badge badge-green" style={{ marginTop: 16 }}>
                {message}
              </div>
            )}

            {error && (
              <div
                className="badge"
                style={{
                  marginTop: 16,
                  background: 'rgba(220,38,38,0.12)',
                  color: '#7f1d1d',
                  border: '1px solid rgba(220,38,38,0.2)',
                }}
              >
                {error}
              </div>
            )}
          </section>

          {/* TOOLS */}
          <div className="card-grid three section">
            <ToolCard
              href="/admin/add-match"
              title="Add Match"
              text="Enter a singles or doubles result and update ratings."
            />
            <ToolCard
              href="/admin/csv-import"
              title="CSV Import"
              text="Bulk import results and detect duplicates."
            />
            <ToolCard
              href="/admin/paste-results"
              title="Paste Results"
              text="Quickly paste and preview match data."
            />
            <ToolCard
              href="/admin/manage-matches"
              title="Manage Matches"
              text="Edit, delete, and rebuild rating history."
            />
            <ToolCard
              href="/admin/manage-players"
              title="Manage Players"
              text="Merge duplicates and clean player data."
            />
            <ToolCard
              href="/admin/upload-scorecard"
              title="Upload Scorecard"
              text="Upload Excel or HTML match data."
            />
          </div>
        </>
      )}
    </main>
  )
}

function ToolCard({
  href,
  title,
  text,
}: {
  href: string
  title: string
  text: string
}) {
  return (
    <Link href={href} className="surface-card panel-pad">
      <div style={{ fontWeight: 800, fontSize: '18px' }}>{title}</div>
      <div className="subtle-text" style={{ marginTop: 8 }}>
        {text}
      </div>
    </Link>
  )
}