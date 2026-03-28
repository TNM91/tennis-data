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

    if (!email.trim()) {
      setError('Enter your email.')
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
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
    await supabase.auth.signOut()
    setUser(null)
  }

  if (authLoading) {
    return <p style={{ padding: '24px' }}>Checking access...</p>
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
        <p style={{ marginTop: '10px', color: '#dbeafe' }}>
          Secure tools for managing matches, imports, and players.
        </p>
      </div>

      {!user ? (
        <div style={cardStyle}>
          <h2>Login</h2>

          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <button onClick={handleSendMagicLink} style={primaryButtonStyle}>
            Send Magic Link
          </button>

          {message && <p style={{ color: 'green' }}>{message}</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : !isAdmin ? (
        <div style={cardStyle}>
          <h2>Not Authorized</h2>
          <p>This account is not the admin.</p>

          <button onClick={handleLogout} style={dangerButtonStyle}>
            Logout
          </button>
        </div>
      ) : (
        <>
          <div style={cardStyle}>
            <h2>Admin Panel</h2>
            <p>Logged in as {user.email}</p>

            <button onClick={handleLogout} style={dangerButtonStyle}>
              Logout
            </button>
          </div>

          <div style={gridStyle}>
            <Link href="/admin/add-match" style={cardLinkStyle}>
              <h3>Add Match</h3>
              <p>Manually add a match result</p>
            </Link>

            <Link href="/admin/csv-import" style={cardLinkStyle}>
              <h3>CSV Import</h3>
              <p>Bulk upload matches</p>
            </Link>

            <Link href="/admin/paste-results" style={cardLinkStyle}>
              <h3>Paste Results</h3>
              <p>Quick paste + preview</p>
            </Link>

            <Link href="/admin/manage-matches" style={cardLinkStyle}>
              <h3>Manage Matches</h3>
              <p>Edit & clean data</p>
            </Link>

            <Link href="/admin/manage-players" style={cardLinkStyle}>
              <h3>Manage Players</h3>
              <p>Rename & merge players</p>
            </Link>
          </div>
        </>
      )}
    </main>
  )
}

const mainStyle = {
  padding: '24px',
  maxWidth: '1000px',
  margin: '0 auto',
}

const navRowStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '20px',
}

const navLinkStyle = {
  padding: '10px',
  background: '#eef2ff',
  borderRadius: '8px',
  textDecoration: 'none',
}

const heroCardStyle = {
  background: '#2563eb',
  color: 'white',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '20px',
}

const cardStyle = {
  background: 'white',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '20px',
}

const inputStyle = {
  display: 'block',
  marginBottom: '12px',
  padding: '10px',
  width: '100%',
}

const primaryButtonStyle = {
  padding: '10px 16px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
}

const dangerButtonStyle = {
  padding: '10px 16px',
  background: 'red',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '16px',
}

const cardLinkStyle = {
  display: 'block',
  background: 'white',
  padding: '20px',
  borderRadius: '12px',
  textDecoration: 'none',
  color: 'black',
}