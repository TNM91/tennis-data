'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  loadPlayerEntryTracker,
  resolvePlayerEntryInformation,
  type PlayerEntryTrackerRecord,
  type PlayerEntryTrackerStatus,
} from '@/lib/player-entry-tracker'
import styles from './player-entry-tracker.module.css'

type EntryDraft = {
  rating: string
  ageDivision: string
  mixedPairRole: string
}

const EMPTY_DRAFT: EntryDraft = { rating: '', ageDivision: '', mixedPairRole: '' }

export default function PlayerEntryTracker() {
  const { userId, authResolved } = useAuth()
  const [entries, setEntries] = useState<PlayerEntryTrackerRecord[]>([])
  const [resolved, setResolved] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!authResolved) return
    let active = true
    if (!userId) {
      const timeoutId = window.setTimeout(() => {
        if (active) setResolved(true)
      }, 0)
      return () => {
        active = false
        window.clearTimeout(timeoutId)
      }
    }

    void loadPlayerEntryTracker(userId)
      .then((records) => {
        if (!active) return
        setEntries(records)
        setLoadError('')
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Your entries could not be loaded.')
      })
      .finally(() => {
        if (active) setResolved(true)
      })

    return () => {
      active = false
    }
  }, [authResolved, userId])

  const summary = useMemo(() => ({
    action: entries.filter((entry) => entry.status === 'needs_information').length,
    waiting: entries.filter((entry) => entry.status === 'submitted').length,
    approved: entries.filter((entry) => entry.status === 'approved').length,
  }), [entries])

  if (!authResolved || !resolved || (!entries.length && !loadError)) return null

  function beginUpdate(entry: PlayerEntryTrackerRecord) {
    setEditingId(entry.id)
    setDraft({
      rating: typeof entry.rating === 'number' ? entry.rating.toFixed(1) : '',
      ageDivision: entry.ageDivision,
      mixedPairRole: entry.mixedPairRole === 'unknown' ? '' : entry.mixedPairRole,
    })
    setNotice('')
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, entry: PlayerEntryTrackerRecord) {
    event.preventDefault()
    if (saving) return
    if (!userId) return
    const rating = draft.rating ? Number(draft.rating) : null
    if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 7)) {
      setNotice('Enter a rating between 1.0 and 7.0.')
      return
    }

    setSaving(true)
    setNotice('')
    try {
      await resolvePlayerEntryInformation({
        kind: entry.kind,
        entryId: entry.id,
        rating,
        ageDivision: draft.ageDivision,
        mixedPairRole: draft.mixedPairRole,
      })
      const refreshed = await loadPlayerEntryTracker(userId)
      setEntries(refreshed)
      setEditingId('')
      setDraft(EMPTY_DRAFT)
      setNotice('Your update was sent. The organizer has been notified.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your update could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.tracker} id="my-entries" aria-labelledby="my-entries-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Your entries</span>
          <h2 id="my-entries-title">Know where every request stands.</h2>
          <p>See the decision or handle missing information here.</p>
        </div>
        <div className={styles.summary} aria-label="Entry status summary">
          <span className={summary.action ? styles.actionCount : undefined}><b>{summary.action}</b> need you</span>
          <span><b>{summary.waiting}</b> reviewing</span>
          <span><b>{summary.approved}</b> approved</span>
        </div>
      </div>

      {loadError ? <div className={styles.error}>{loadError}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      <div className={styles.list}>
        {entries.slice(0, 6).map((entry) => {
          const needsInfo = entry.status === 'needs_information'
          const editing = editingId === entry.id
          return (
            <article className={`${styles.entry} ${needsInfo ? styles.entryAction : ''}`} key={`${entry.kind}-${entry.id}`}>
              <div className={styles.entryTop}>
                <div className={styles.entryCopy}>
                  <span>{entry.kind === 'tournament' ? 'Tournament' : 'League'}</span>
                  <h3>{entry.competitionName}</h3>
                  <p>{entry.detail}</p>
                </div>
                <span className={`${styles.status} ${statusClass(entry.status)}`}>{statusLabel(entry.status)}</span>
              </div>

              <EntryProgress status={entry.status} />

              {needsInfo ? (
                <div className={styles.request}>
                  <strong>Organizer question</strong>
                  <p>{entry.requestNote || 'Please confirm the missing entry details.'}</p>
                </div>
              ) : null}

              {editing ? (
                <form className={styles.form} onSubmit={(event) => void submitUpdate(event, entry)}>
                  <label>
                    <span>Rating</span>
                    <input type="number" min="1" max="7" step="0.1" value={draft.rating} onChange={(event) => setDraft((current) => ({ ...current, rating: event.target.value }))} placeholder="4.0" />
                  </label>
                  <label>
                    <span>Age division</span>
                    <input value={draft.ageDivision} onChange={(event) => setDraft((current) => ({ ...current, ageDivision: event.target.value }))} placeholder="40 & Over" />
                  </label>
                  <label>
                    <span>Mixed role</span>
                    <select value={draft.mixedPairRole} onChange={(event) => setDraft((current) => ({ ...current, mixedPairRole: event.target.value }))}>
                      <option value="">Not applicable</option>
                      <option value="woman">Woman</option>
                      <option value="man">Man</option>
                    </select>
                  </label>
                  <div className={styles.formActions}>
                    <button type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send update'}</button>
                    <button type="button" className={styles.secondary} onClick={() => setEditingId('')} disabled={saving}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className={styles.actions}>
                  {needsInfo ? <button type="button" onClick={() => beginUpdate(entry)}>Add missing info</button> : null}
                  <Link href={entry.href}>Open {entry.kind}</Link>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function EntryProgress({ status }: { status: PlayerEntryTrackerStatus }) {
  const decisionReached = status === 'approved' || status === 'not_approved'
  return (
    <div className={styles.progress} aria-label={`Entry progress: ${statusLabel(status)}`}>
      <span className={styles.done}>Submitted</span>
      <span className={status === 'needs_information' ? styles.current : decisionReached ? styles.done : styles.current}>Review</span>
      <span className={decisionReached ? status === 'approved' ? styles.done : styles.declined : undefined}>Decision</span>
    </div>
  )
}

function statusLabel(status: PlayerEntryTrackerStatus) {
  if (status === 'needs_information') return 'Needs information'
  if (status === 'approved') return 'Approved'
  if (status === 'not_approved') return 'Not approved'
  return 'Submitted'
}

function statusClass(status: PlayerEntryTrackerStatus) {
  if (status === 'needs_information') return styles.statusAction
  if (status === 'approved') return styles.statusApproved
  if (status === 'not_approved') return styles.statusDeclined
  return styles.statusWaiting
}
