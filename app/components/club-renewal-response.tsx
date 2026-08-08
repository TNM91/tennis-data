'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getClubGroupTypeLabel, type ClubGroupType } from '@/lib/club-workspace'
import styles from './club-workspace.module.css'

type RenewalPreview = {
  clubName: string
  clubSlug: string
  clubLogoUrl: string
  groupName: string
  groupType: string
  seasonLabel: string
  playerName: string
  status: 'pending' | 'confirmed' | 'declined'
  expiresAt: string
  expired: boolean
}

export default function ClubRenewalResponse({ token }: { token: string }) {
  const [renewal, setRenewal] = useState<RenewalPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/clubs/renewals/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { renewal?: RenewalPreview; message?: string }
        if (!response.ok || !data.renewal) throw new Error(data.message || 'This renewal link is unavailable.')
        setRenewal(data.renewal)
      })
      .catch((nextError) => {
        if (nextError instanceof DOMException && nextError.name === 'AbortError') return
        setError(nextError instanceof Error ? nextError.message : 'This renewal link is unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token])

  async function respond(status: 'confirmed' | 'declined') {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/clubs/renewals/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json() as { message?: string }
      if (!response.ok) throw new Error(data.message || 'Your response could not be saved.')
      setRenewal((current) => current ? { ...current, status } : current)
      setMessage(data.message || 'Your response is saved.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Your response could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const title = loading ? 'Opening your season...' : renewal ? `Will you join ${renewal.groupName}?` : 'Renewal unavailable'
  const expired = renewal?.expired === true
  return (
    <main className={styles.page}>
      <section className={`${styles.empty} ${styles.inviteShell}`}>
        {renewal?.clubLogoUrl ? <Image className={styles.inviteLogo} src={renewal.clubLogoUrl} alt={`${renewal.clubName} logo`} width={72} height={72} unoptimized /> : null}
        <div>
          <p className={styles.eyebrow}>Season confirmation</p>
          <h1 className={styles.title}>{title}</h1>
        </div>

        {renewal ? <>
          <p className={styles.copy}><strong>{renewal.playerName}</strong>, let {renewal.clubName} know whether you are returning.</p>
          <div className={styles.inviteDestination}>
            <p className={styles.eyebrow}>{renewal.seasonLabel || 'New season'}</p>
            <strong>{renewal.groupName}</strong>
            <span>{getClubGroupTypeLabel(renewal.groupType as ClubGroupType)}</span>
          </div>
          {expired ? <div className={`${styles.notice} ${styles.danger}`} role="alert">This response link has expired. Ask the club to prepare a new one.</div> : null}
          {renewal.status !== 'pending' ? <div className={styles.inviteSuccess} role="status"><strong>{renewal.status === 'confirmed' ? 'You said yes.' : 'You said no.'}</strong><span>You can change your answer below while this link is active.</span></div> : null}
          <div className={styles.renewalDecision} role="group" aria-label="Will you return this season?">
            <button className={styles.primary} disabled={saving || expired} type="button" onClick={() => void respond('confirmed')}>{saving ? 'Saving...' : 'Yes, I am returning'}</button>
            <button className={styles.secondary} disabled={saving || expired} type="button" onClick={() => void respond('declined')}>No, not this season</button>
          </div>
          {message ? <div className={`${styles.notice} ${styles.success}`} role="status">{message}</div> : null}
          <Link className={styles.quietButton} href={`/clubs/${renewal.clubSlug}`}>View {renewal.clubName}</Link>
        </> : null}

        {error ? <div className={`${styles.notice} ${styles.danger}`} role="alert">{error}</div> : null}
      </section>
    </main>
  )
}
