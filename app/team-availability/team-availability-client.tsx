'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/components/auth-provider'
import SeasonAvailabilityClient from '@/app/season-availability/season-availability-client'
import styles from '@/app/components/season-kickoff.module.css'

export default function TeamAvailabilityClient({ query }: { query: string }) {
  const { session, userId, authResolved } = useAuth()
  // A changed account must unmount the private response editor immediately.
  return <AccountAvailability key={`${userId || 'signed-out'}:${query}`} query={query} token={session?.access_token || ''} resolved={authResolved} />
}

function AccountAvailability({ token, resolved, query }: { token: string; resolved: boolean; query: string }) {
  const [data, setData] = useState<{ responseToken: string; focusMatchId: string } | null>(null)
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [busy, setBusy] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => { setBusy(true); setError(''); setAction(''); setAttempt(value => value + 1) }, [])
  useEffect(() => {
    if (!token) return
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    void fetch(`/api/team-availability${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json()
        if (!active) return
        if (!response.ok) { setData(null); setAction(result.action || ''); throw new Error(result.message || 'Please retry.') }
        setError(''); setAction(''); setData(result)
      }).catch(cause => { if (active) setError(cause?.name === 'AbortError' ? 'Loading took too long. Please retry.' : cause.message) })
      .finally(() => { clearTimeout(timeout); if (active) setBusy(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [token, query, attempt])
  if (token && data) return <SeasonAvailabilityClient responseToken={data.responseToken} focusMatchId={data.focusMatchId} groupEntry />
  const next = encodeURIComponent(`/team-availability${query || ''}`)
  return <main className={styles.page}><section className={styles.panel}>
    <p>TenAceIQ · Team availability</p><h1>Let your captain know.</h1>
    <p>Answer for yourself, plan other season dates if you know them, and add matches to your calendar. This does not confirm a final lineup.</p>
    {!resolved || (token && busy) ? <p role="status">Opening your availability…</p> : !token ? <>
      <p>This group link is shared. Sign in so only your own answers open. No paid membership is needed to reply.</p>
      <div className={styles.actions}><Link className={styles.button} href={`/login?next=${next}`}>Sign in to answer</Link><Link className={styles.secondary} href={`/join?next=${next}`}>Create free account</Link></div>
    </> : null}
    {error ? <div className={styles.feedback} role="alert"><p>{error}</p>
      {action === 'profile' ? <Link href="/profile" className={styles.secondary}>Link my player record</Link> : null}
      {action === 'team' ? <Link href="/team-connections" className={styles.secondary}>Review my team links</Link> : null}
      <button className={styles.secondary} disabled={busy} onClick={retry}>Try again</button></div> : null}
  </section></main>
}
