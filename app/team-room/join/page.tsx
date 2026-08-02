'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import styles from '../team-room.module.css'

type TeamInvite = {
  teamName: string
  leagueName: string
  flight: string
  expiresAt: string
  alreadyJoined: boolean
  roomHref: string
}

export default function TeamRoomJoinPage() {
  return (
    <SiteShell active="/messages">
      <Suspense fallback={<JoinLoading />}>
        <JoinContent />
      </Suspense>
    </SiteShell>
  )
}

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authResolved, session } = useAuth()
  const token = searchParams.get('token')?.trim() || ''
  const accessToken = session?.access_token || ''
  const [invite, setInvite] = useState<TeamInvite | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authResolved) return
    if (!accessToken || !token) {
      setLoading(false)
      return
    }
    let active = true
    void (async () => {
      try {
        const response = await fetch(`/api/team-rooms/join?token=${encodeURIComponent(token)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        })
        const payload = await response.json() as { ok?: boolean; message?: string; invite?: TeamInvite }
        if (!response.ok || !payload.ok || !payload.invite) throw new Error(payload.message || 'Team invite could not be opened.')
        if (active) setInvite(payload.invite)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Team invite could not be opened.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [accessToken, authResolved, token])

  async function joinTeam() {
    if (!accessToken || !token || joining) return
    setJoining(true)
    setError('')
    try {
      const response = await fetch('/api/team-rooms/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })
      const payload = await response.json() as { ok?: boolean; message?: string; roomHref?: string }
      if (!response.ok || !payload.ok || !payload.roomHref) throw new Error(payload.message || 'Team could not be joined.')
      router.replace(payload.roomHref)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Team could not be joined.')
      setJoining(false)
    }
  }

  if (!authResolved || loading) return <JoinLoading />
  const next = `/team-room/join?token=${encodeURIComponent(token)}`

  if (!accessToken) {
    return (
      <main className={styles.page}>
        <section className={styles.stateCard}>
          <p className={styles.eyebrow}>Team invitation</p>
          <h1>Sign in to join your team.</h1>
          <p className={styles.helper}>After signing in, this link connects the team to your profile and opens its shared Team Room.</p>
          <div className={styles.roomActions}>
            <Link className={styles.buttonPrimary} href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
            <Link className={styles.buttonSecondary} href={`/join?next=${encodeURIComponent(next)}`}>Create account</Link>
          </div>
        </section>
      </main>
    )
  }

  if (!invite) {
    return (
      <main className={styles.page}>
        <section className={styles.stateCard}>
          <p className={styles.eyebrow}>Team invitation</p>
          <h1>This invite cannot be opened.</h1>
          <p className={styles.helper}>{error || 'Ask your captain to share a new Team Room invitation.'}</p>
          <Link className={styles.buttonSecondary} href="/team-connections">Review my teams</Link>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.stateCard}>
        <p className={styles.eyebrow}>You’re invited</p>
        <h1>Join {invite.teamName}.</h1>
        <p className={styles.helper}>
          {[invite.leagueName, invite.flight].filter(Boolean).join(' · ') || 'Team Room'}
        </p>
        <p className={styles.helper}>Connect this team to your profile to receive announcements, share match-week updates, and keep the conversation in one place.</p>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <div className={styles.roomActions}>
          {invite.alreadyJoined ? (
            <Link className={styles.buttonPrimary} href={invite.roomHref}>Open Team Room</Link>
          ) : (
            <button className={styles.buttonPrimary} type="button" disabled={joining} onClick={() => void joinTeam()}>
              {joining ? 'Joining…' : 'Join team'}
            </button>
          )}
          <Link className={styles.buttonSecondary} href="/team-connections">Review my teams</Link>
        </div>
      </section>
    </main>
  )
}

function JoinLoading() {
  return (
    <main className={styles.page}>
      <section className={styles.stateCard}>
        <p className={styles.eyebrow}>Team invitation</p>
        <h1>Opening your invitation…</h1>
      </section>
    </main>
  )
}
