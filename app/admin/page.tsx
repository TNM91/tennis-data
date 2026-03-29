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
      <main style={mainStyle}>
        <div style={navRowStyle}>
          <Link href="/" style={navLinkStyle}>Home</Link>
          <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
          <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
          <Link href="/admin" style={navLinkStyle}>Admin</Link>
        </div>

        <div style={cardStyle}>
          <p style={{ margin: 0, fontWeight: 700 }}>Checking access...</p>
        </div>
      </main>
    )
  }

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '38px' }}>Admin Control Center</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '800px' }}>
          Secure tools for managing matches, imports, and players.
        </p>
      </div>

      {!user ? (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Admin Login</h2>
          <p style={subtleParagraphStyle}>
            Sign in with your admin email to access protected tools.
          </p>

          <div style={filtersGridStyle}>
            <input
              type="email"
              placeholder="Your admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={handleSendMagicLink} style={primaryButtonStyle}>
              Send Magic Link
            </button>
          </div>

          {message && (
            <div style={successBoxStyle}>
              <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>
            </div>
          )}

          {error && (
            <div style={errorBoxStyle}>
              <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
            </div>
          )}
        </div>
      ) : !isAdmin ? (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Not Authorized</h2>
          <p style={subtleParagraphStyle}>
            You are logged in, but this account is not the admin account for this site.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={handleLogout} style={dangerButtonStyle}>
              Logout
            </button>
          </div>

          {message && (
            <div style={successBoxStyle}>
              <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>
            </div>
          )}

          {error && (
            <div style={errorBoxStyle}>
              <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={statsGridStyle}>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Status</div>
              <div style={statValueStyle}>Admin</div>
            </div>

            <div style={statCardStyle}>
              <div style={statLabelStyle}>Tools</div>
              <div style={statValueStyle}>5</div>
            </div>

            <div style={statCardStyle}>
              <div style={statLabelStyle}>Session</div>
              <div style={{ ...statValueStyle, fontSize: '22px' }}>Active</div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={toolbarStyle}>
              <div>
                <h2 style={{ margin: 0 }}>Admin Panel</h2>
                <p style={{ ...subtleParagraphStyle, marginTop: '8px', marginBottom: 0 }}>
                  Logged in as <strong>{user.email}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={handleLogout} style={dangerButtonStyle}>
                  Logout
                </button>
              </div>
            </div>

            {message && (
              <div style={successBoxStyle}>
                <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>
              </div>
            )}

            {error && (
              <div style={errorBoxStyle}>
                <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
              </div>
            )}
          </div>

          <div style={toolGridStyle}>
            <Link href="/admin/add-match" style={toolCardStyle}>
              <div style={toolTitleStyle}>Add Match</div>
              <div style={toolTextStyle}>
                Enter a singles or doubles result manually and update ratings.
              </div>
            </Link>

            <Link href="/admin/csv-import" style={toolCardStyle}>
              <div style={toolTitleStyle}>CSV Import</div>
              <div style={toolTextStyle}>
                Bulk import results, preview duplicates, and create missing players.
              </div>
            </Link>

            <Link href="/admin/paste-results" style={toolCardStyle}>
              <div style={toolTitleStyle}>Paste Results</div>
              <div style={toolTextStyle}>
                Paste match lines quickly, preview them, and import safely.
              </div>
            </Link>

            <Link href="/admin/manage-matches" style={toolCardStyle}>
              <div style={toolTitleStyle}>Manage Matches</div>
              <div style={toolTextStyle}>
                Edit rows, delete bad entries, and rebuild ratings when needed.
              </div>
            </Link>

            <Link href="/admin/manage-players" style={toolCardStyle}>
              <div style={toolTitleStyle}>Manage Players</div>
              <div style={toolTextStyle}>
                Rename players, merge duplicates, and clean up records.
              </div>
            </Link>
          </div>
        </>
      )}
    </main>
  )
}

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1250px',
  margin: '0 auto',
  background: '#f8fafc',
  minHeight: '100vh',
}

const navRowStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '24px',
  flexWrap: 'wrap' as const,
}

const navLinkStyle = {
  padding: '10px 14px',
  border: '1px solid #dbeafe',
  borderRadius: '999px',
  textDecoration: 'none',
  color: '#1e3a8a',
  background: '#eff6ff',
  fontWeight: 600,
}

const heroCardStyle = {
  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
  color: 'white',
  borderRadius: '20px',
  padding: '28px',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.20)',
  marginBottom: '22px',
}

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
  marginBottom: '22px',
}

const statCardStyle = {
  background: 'white',
  borderRadius: '18px',
  padding: '18px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
}

const statLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const statValueStyle = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: 800,
}

const cardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  marginBottom: '22px',
}

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap' as const,
}

const filtersGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  flex: 1,
  minWidth: '320px',
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  fontSize: '15px',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  background: 'white',
}

const primaryButtonStyle = {
  padding: '12px 16px',
  border: 'none',
  borderRadius: '12px',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
}

const dangerButtonStyle = {
  padding: '12px 16px',
  border: 'none',
  borderRadius: '12px',
  background: '#dc2626',
  color: 'white',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
}

const successBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
}

const errorBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#991b1b',
}

const subtleParagraphStyle = {
  color: '#64748b',
  fontSize: '15px',
  maxWidth: '760px',
}

const toolGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
  marginBottom: '22px',
}

const toolCardStyle = {
  background: 'white',
  borderRadius: '18px',
  padding: '18px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  textDecoration: 'none',
  display: 'block',
  color: '#0f172a',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
}

const toolTitleStyle = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 800,
  marginBottom: '8px',
}

const toolTextStyle = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: 1.5,
}