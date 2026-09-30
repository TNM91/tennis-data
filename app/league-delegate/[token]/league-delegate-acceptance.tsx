'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'

type Invite = {
  email: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expiresAt: string
  leagueName: string
  logoUrl: string
}

export default function LeagueDelegateAcceptance({ token }: { token: string }) {
  const { authResolved, session, userId } = useAuth()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [message, setMessage] = useState('Opening league invitation…')
  const [busy, setBusy] = useState(false)
  const [leagueId, setLeagueId] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`/api/league-delegates/${encodeURIComponent(token)}`)
    const payload = await response.json() as { ok?: boolean; invite?: Invite; message?: string }
    if (!response.ok || !payload.invite) setMessage(payload.message || 'This league invitation could not be opened.')
    else {
      setInvite(payload.invite)
      setMessage('')
    }
  }, [token])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  async function accept() {
    if (!session?.access_token) return
    setBusy(true)
    const response = await fetch(`/api/league-delegates/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const payload = await response.json() as { ok?: boolean; leagueId?: string; message?: string }
    if (!response.ok) setMessage(payload.message || 'League access could not be activated.')
    else {
      setLeagueId(payload.leagueId || '')
      setInvite((current) => current ? { ...current, status: 'accepted' } : current)
      setMessage('League access is active. You can now help run weekly play.')
    }
    setBusy(false)
  }

  const nextHref = `/league-delegate/${encodeURIComponent(token)}`
  const loginHref = `/login?${new URLSearchParams({ next: nextHref, email: invite?.email || '', switchAccount: '1' }).toString()}`
  const joinHref = `/join?${new URLSearchParams({ next: nextHref, email: invite?.email || '' }).toString()}`
  const signedInEmail = session?.user.email?.trim().toLowerCase() || ''
  const emailMatches = Boolean(invite?.email && signedInEmail === invite.email.trim().toLowerCase())
  const accepted = invite?.status === 'accepted'

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>League Office invitation</p>
        {invite?.logoUrl ? (
          // League owners may use an existing hosted logo outside the configured image domains.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={invite.logoUrl} alt="" style={logoStyle} />
        ) : null}
        <h1 style={titleStyle}>{invite?.leagueName || 'League delegate access'}</h1>
        <p style={copyStyle}>Help the league owner collect replies, confirm weekly rosters, publish courts, and prepare recaps.</p>

        {invite ? (
          <div style={detailStyle}>
            <span>Invited email<strong style={{ display: 'block' }}>{invite.email}</strong></span>
            <span>Status<strong style={{ display: 'block', textTransform: 'capitalize' }}>{accepted ? 'Access active' : invite.status}</strong></span>
          </div>
        ) : null}

        {message ? <p role="status" style={noticeStyle}>{message}</p> : null}

        {!authResolved ? <span style={mutedStyle}>Checking your account…</span>
          : !invite ? <Link href="/league-coordinator" style={secondaryButtonStyle}>Open League Office</Link>
            : accepted ? <Link href={`/league-coordinator/weekly${leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : ''}`} style={buttonStyle}>Open weekly play</Link>
            : !userId ? <div style={actionsStyle}><Link href={loginHref} style={buttonStyle}>Sign in to accept</Link><Link href={joinHref} style={secondaryButtonStyle}>Create account</Link></div>
              : !emailMatches ? <div style={actionsStyle}><p style={noticeStyle}>This invitation is for {invite?.email}. You are signed in as {signedInEmail || 'another account'}.</p><Link href={loginHref} style={secondaryButtonStyle}>Switch account</Link></div>
                : invite?.status === 'pending' ? <button type="button" onClick={() => void accept()} disabled={busy} style={buttonStyle}>{busy ? 'Activating…' : 'Accept league access'}</button>
                  : null}
      </section>
    </main>
  )
}

const pageStyle: CSSProperties = { minHeight: '72vh', display: 'grid', placeItems: 'center', padding: '28px 16px 80px' }
const cardStyle: CSSProperties = { width: 'min(100%, 660px)', display: 'grid', gap: 16, padding: 'clamp(22px,5vw,42px)', border: '1px solid rgba(155,225,29,.22)', borderRadius: 24, background: 'linear-gradient(150deg,#071a2d,#081426)', color: '#f7fbff', boxShadow: '0 28px 80px rgba(0,0,0,.3)' }
const eyebrowStyle: CSSProperties = { margin: 0, color: '#9be11d', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }
const titleStyle: CSSProperties = { margin: 0, fontSize: 'clamp(2rem,7vw,4rem)', lineHeight: 1, letterSpacing: '-.05em' }
const copyStyle: CSSProperties = { margin: 0, color: '#b8c8dc', fontSize: 16, lineHeight: 1.6 }
const logoStyle: CSSProperties = { width: 76, height: 76, borderRadius: 16, objectFit: 'cover', background: '#fff' }
const detailStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }
const noticeStyle: CSSProperties = { margin: 0, padding: 13, borderRadius: 12, background: 'rgba(155,225,29,.1)', color: '#e8f3df', lineHeight: 1.5 }
const mutedStyle: CSSProperties = { color: '#b8c8dc' }
const actionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }
const buttonStyle: CSSProperties = { width: 'fit-content', border: 0, borderRadius: 999, padding: '12px 18px', background: '#9be11d', color: '#071226', fontWeight: 900, textDecoration: 'none', cursor: 'pointer' }
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff' }
