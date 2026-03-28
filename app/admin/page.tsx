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

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = user?.id === ADMIN_ID

  async function handleSendMagicLink() {
    setError('')
    setMessage('')

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Enter your email address.')
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

    setMessage('Logged out successfully.')
  }

  if (authLoading) {
    return <p style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>Checking access...</p>
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
        <h1 style={{ margin: 0, fontSize: '36px' }}>Admin</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Secure access for match entry, imports, and player management.
        </p>
      </div>

      {!user ? (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Admin Login</h2>
          <p style={subtleTextStyle}>
            Sign in with your admin email to access protected tools.
          </p>

          <div style={formGridStyle}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your admin email"
              style={inputStyle}
            />

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
          <h2 style={{ marginTop: 0 }}>Not Authorized</h2>
          <p style={subtleTextStyle}>
            You are logged in, but this account is not the admin account for this site.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={handleLogout} style={dangerButtonStyle}>
              Logout
            </button>
            <Link href="/" style={secondaryLinkStyle}>Go Home</Link>
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
          <div style={cardStyle}>
            <div style={adminHeaderRowStyle}>
              <div>
                <h2 style={{ margin: 0 }}>Admin Panel</h2>
                <p style={{ ...subtleTextStyle, marginTop: '8px' }}>
                  Signed in as: <strong>{user.email}</strong>
                </p>
              </div>

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

          <div style={toolGridStyle}>
            <Link href="/add-match" style={toolCardStyle}>
              <h3 style={toolTitleStyle}>Add Match</h3>
              <p style={toolTextStyle}>Enter a singles or doubles match result manually.</p>
            </Link>

            <Link href="/csv-import" style={toolCardStyle}>
              <h3 style={toolTitleStyle}>CSV Import</h3>
              <p style={toolTextStyle}>Paste CSV rows, preview duplicates, and import in bulk.</p>
            </Link>

            <Link href="/paste-results" style={toolCardStyle}>
              <h3 style={toolTitleStyle}>Paste Results</h3>
              <p style={toolTextStyle}>Paste match lines, preview them, and import quickly.</p>
            </Link>

            <Link href="/manage-matches" style={toolCardStyle}>
              <h3 style={toolTitleStyle}>Manage Matches</h3>
              <p style={toolTextStyle}>Edit match rows, delete bad rows, and rebuild ratings.</p>
            </Link>

            <Link href="/manage-players" style={toolCardStyle}>
              <h3 style={toolTitleStyle}>Manage Players</h3>
              <p style={toolTextStyle}>Rename players, merge duplicates, and clean up records.</p>
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
  maxWidth: '1100px',
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

const cardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  marginBottom: '22px',
}

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 1fr) auto',
  gap: '12px',
  alignItems: 'center',
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
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  fontSize: '15px',
  cursor: 'pointer',
}

const dangerButtonStyle = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#dc2626',
  color: 'white',
  fontWeight: 700,
  fontSize: '15px',
  cursor: 'pointer',
}

const secondaryLinkStyle = {
  display: 'inline-block',
  padding: '14px 18px',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  background: 'white',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '15px',
  textDecoration: 'none',
}

const subtleTextStyle = {
  color: '#64748b',
  marginBottom: '16px',
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

const adminHeaderRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
}

const toolGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
}

const toolCardStyle = {
  display: 'block',
  textDecoration: 'none',
  background: 'white',
  borderRadius: '20px',
  padding: '22px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  color: '#0f172a',
}

const toolTitleStyle = {
  margin: '0 0 10px 0',
  fontSize: '20px',
}

const toolTextStyle = {
  margin: 0,
  color: '#64748b',
  lineHeight: 1.5,
}