'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { getClubRoleLabel, type ClubRole } from '@/lib/club-workspace'
import styles from './club-workspace.module.css'

type InvitePreview = {
  clubName: string
  clubSlug: string
  clubLogoUrl: string
  email: string
  roles: ClubRole[]
  status: string
  expiresAt: string
}

export default function ClubInviteAcceptance({ token }: { token: string }) {
  const { authResolved, session, userId } = useAuth()
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/clubs/invites/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { ok: boolean; invite?: InvitePreview; message?: string }
        if (!response.ok || !data.invite) throw new Error(data.message || 'Invitation not found.')
        setInvite(data.invite)
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Invitation not found.'))
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [token])

  async function acceptInvite() {
    if (!session?.access_token) return
    setAccepting(true)
    setMessage('')
    try {
      const response = await fetch(`/api/clubs/invites/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json() as { ok: boolean; clubId?: string; message?: string }
      if (!response.ok) throw new Error(data.message || 'This invitation could not be accepted.')
      window.location.assign(`/clubs?clubId=${encodeURIComponent(data.clubId || '')}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This invitation could not be accepted.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.empty}>
        <p className={styles.eyebrow}>Club invitation</p>
        <h1 className={styles.title}>{loading ? 'Opening invitation...' : invite ? `Join ${invite.clubName}` : 'Invitation unavailable'}</h1>
        {invite ? <><p className={styles.copy}>Connect this club to your profile as {invite.roles.map(getClubRoleLabel).join(' + ')}.</p><div className={styles.roleList}>{invite.roles.map((role) => <span className={styles.pill} key={role}>{getClubRoleLabel(role)}</span>)}</div></> : null}
        {message ? <div className={`${styles.notice} ${styles.danger}`}>{message}</div> : null}
        {!authResolved ? null : !userId ? <div className={styles.row}><Link className={styles.primary} href={`/login?next=${encodeURIComponent(`/clubs/invite/${token}`)}`}>Sign in to accept</Link><Link className={styles.secondary} href={`/join?next=${encodeURIComponent(`/clubs/invite/${token}`)}`}>Create account</Link></div> : invite?.status === 'pending' ? <button className={styles.primary} disabled={accepting} type="button" onClick={() => void acceptInvite()}>{accepting ? 'Connecting...' : 'Accept and open club'}</button> : <p className={styles.copy}>This invitation is {invite?.status || 'not active'}.</p>}
      </section>
    </main>
  )
}
