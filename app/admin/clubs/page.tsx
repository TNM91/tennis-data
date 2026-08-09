'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { canDeleteClubWithConfirmation, type AdminClubSummary } from '@/lib/admin-clubs'
import styles from './page.module.css'

type ClubResponse = {
  ok?: boolean
  clubs?: AdminClubSummary[]
  message?: string
  warning?: string
}

export default function AdminClubsPage() {
  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminClubManager />
      </AdminGate>
    </SiteShell>
  )
}

function AdminClubManager() {
  const { session, role, authResolved } = useAuth()
  const [clubs, setClubs] = useState<AdminClubSummary[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [confirmationName, setConfirmationName] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success')

  useEffect(() => {
    if (!authResolved || role !== 'admin' || !session?.access_token) return
    void loadClubs(session.access_token)
  }, [authResolved, role, session?.access_token])

  async function loadClubs(accessToken: string) {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/clubs', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const payload = await response.json() as ClubResponse
      if (!response.ok || !payload.clubs) throw new Error(payload.message || 'Club accounts could not be loaded.')
      setClubs(payload.clubs)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Club accounts could not be loaded.')
      setMessageTone('danger')
    } finally {
      setLoading(false)
    }
  }

  async function deleteClub(club: AdminClubSummary) {
    if (!session?.access_token || !canDeleteClubWithConfirmation(club.name, confirmationName)) return
    setWorking(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/clubs', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubId: club.id, confirmationName }),
      })
      const payload = await response.json() as ClubResponse
      if (!response.ok) throw new Error(payload.message || 'The club could not be deleted.')
      setClubs((current) => current.filter((item) => item.id !== club.id))
      setSelectedClubId('')
      setConfirmationName('')
      setMessage(payload.warning ? `${payload.message} ${payload.warning}` : payload.message || `${club.name} was deleted.`)
      setMessageTone(payload.warning ? 'danger' : 'success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The club could not be deleted.')
      setMessageTone('danger')
    } finally {
      setWorking(false)
    }
  }

  const visibleClubs = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return clubs
    return clubs.filter((club) => [club.name, club.slug, club.locationLabel].some((value) => value.toLocaleLowerCase().includes(term)))
  }, [clubs, query])

  return (
    <AdminReviewFrame>
      <div className={styles.shell}>
        <AdminReviewHero
          kicker="Club accounts"
          title="Manage clubs"
          actions={<Link className="button-secondary" href="/admin">Back to Admin</Link>}
        >
          Find a club, review its footprint, or remove a workspace that should no longer exist.
        </AdminReviewHero>

        <AdminReviewPanel compact>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <span>Find a club</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, location, or slug" />
            </label>
            <span className={styles.count}>{visibleClubs.length} of {clubs.length} clubs</span>
          </div>

          {message ? <p className={styles.notice} data-tone={messageTone} role={messageTone === 'danger' ? 'alert' : 'status'}>{message}</p> : null}

          {loading ? <div className={styles.empty}>Loading clubs...</div> : null}
          {!loading && !visibleClubs.length ? <div className={styles.empty}>No clubs match this search.</div> : null}

          <div className={styles.list}>
            {visibleClubs.map((club) => {
              const confirming = selectedClubId === club.id
              const canDelete = canDeleteClubWithConfirmation(club.name, confirmationName)
              return (
                <article className={styles.clubCard} key={club.id}>
                  <div className={styles.clubCopy}>
                    <div className={styles.clubTop}>
                      <h2>{club.name}</h2>
                      <span className={styles.status}>{club.isPublic ? 'Public' : 'Private'}</span>
                    </div>
                    <div className={styles.meta}>
                      {club.locationLabel ? <span>{club.locationLabel}</span> : null}
                      <span>{club.memberCount} members</span>
                      <span>{club.programCount} active programs</span>
                      <span>Updated {new Date(club.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <Link className={styles.link} href={`/clubs/${club.slug}`}>Open club</Link>
                    <button
                      className={styles.deleteButton}
                      disabled={working}
                      type="button"
                      onClick={() => {
                        setSelectedClubId(confirming ? '' : club.id)
                        setConfirmationName('')
                        setMessage('')
                      }}
                    >
                      {confirming ? 'Cancel deletion' : 'Delete club'}
                    </button>
                  </div>

                  {confirming ? (
                    <div className={styles.confirmPanel}>
                      <strong>This permanently deletes {club.name}.</strong>
                      <p>Club members, programs, messages, invites, and templates will be removed. Linked TIQ leagues and tournaments remain, but will no longer be attached to this club.</p>
                      <label className={styles.search}>
                        <span>Type {club.name} to confirm</span>
                        <input
                          className={styles.confirmInput}
                          autoComplete="off"
                          value={confirmationName}
                          onChange={(event) => setConfirmationName(event.target.value)}
                        />
                      </label>
                      <div className={styles.confirmActions}>
                        <button className={styles.cancelButton} disabled={working} type="button" onClick={() => { setSelectedClubId(''); setConfirmationName('') }}>Keep club</button>
                        <button className={styles.confirmButton} disabled={working || !canDelete} type="button" onClick={() => void deleteClub(club)}>
                          {working ? 'Deleting...' : 'Permanently delete club'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </AdminReviewPanel>
      </div>
    </AdminReviewFrame>
  )
}
