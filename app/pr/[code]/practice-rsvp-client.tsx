'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { buildPracticeGoogleCalendarHref, type PracticeDisplayStatus, type PracticeResponseStatus } from '@/lib/captain-practice-rsvp'
import styles from './practice-rsvp.module.css'

type Payload = {
  practice: {
    teamName: string
    leagueName: string
    scheduledDate: string
    scheduledTime: string
    facility: string
    notes: string
    status: string
    capacity: number | null
  }
  roster: Array<{
    id: string
    playerName: string
    responseStatus: PracticeResponseStatus
    respondedAt: string
    displayStatus: PracticeDisplayStatus
  }>
  selectedStatus: PracticeDisplayStatus | null
}

export default function PracticeRsvpClient({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState<PracticeResponseStatus | ''>('')
  const [savedStatus, setSavedStatus] = useState<PracticeDisplayStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch(`/api/practice/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json() as Payload & { message?: string }
        if (!response.ok) throw new Error(payload.message || 'This practice link could not be opened.')
        if (active) setData(payload)
      })
      .catch((nextError: unknown) => {
        if (active) setError(nextError instanceof Error ? nextError.message : 'This practice link could not be opened.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token])

  const groups = useMemo(() => {
    const next = new Map<PracticeDisplayStatus, string[]>([
      ['in', []], ['waitlist', []], ['maybe', []], ['out', []], ['unanswered', []],
    ])
    data?.roster.forEach((player) => next.get(player.displayStatus)?.push(player.playerName))
    return next
  }, [data])

  async function respond(status: Exclude<PracticeResponseStatus, 'unanswered'>) {
    if (!playerName) {
      setError('Choose your name first.')
      return
    }
    setSaving(status)
    setError('')
    try {
      const response = await fetch(`/api/practice/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, status, note }),
      })
      const payload = await response.json() as Payload & { message?: string }
      if (!response.ok) throw new Error(payload.message || 'Your RSVP could not be saved.')
      setData(payload)
      setSavedStatus(payload.selectedStatus)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Your RSVP could not be saved.')
    } finally {
      setSaving('')
    }
  }

  if (loading) return <main className={styles.page}><section className={styles.card}>Loading practice...</section></main>
  if (!data) return <main className={styles.page}><section className={styles.card}><h1>Link unavailable</h1><p>{error}</p></section></main>

  const practice = data.practice
  const confirmedCount = groups.get('in')?.length || 0
  const calendarHref = buildPracticeGoogleCalendarHref(practice)
  const phoneCalendarHref = `/api/practice/${encodeURIComponent(token)}/calendar.ics`
  const directionsHref = practice.facility
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.facility)}`
    : ''
  const responseHeadline = savedStatus === 'waitlist'
    ? 'You’re on the waitlist.'
    : savedStatus === 'in'
      ? 'You’re in.'
      : savedStatus === 'maybe'
        ? 'Maybe saved.'
        : savedStatus === 'out'
          ? 'You’re marked out.'
          : ''

  return (
    <main className={styles.page}>
      <header className={styles.brandBar}>
        <Image src="/brand/web/header-logo-transparent.png" alt="TenAceIQ" width={258} height={86} priority />
        <span>Practice RSVP</span>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Team practice</p>
        <h1>{practice.teamName}</h1>
        <p className={styles.when}>{formatDate(practice.scheduledDate)}{formatTime(practice.scheduledTime) ? ` · ${formatTime(practice.scheduledTime)}` : ''}</p>
        {practice.facility ? <p className={styles.site}>{practice.facility}</p> : null}
        <div className={styles.heroActions}>
          <a href={phoneCalendarHref}>Add to iPhone</a>
          {calendarHref ? <a href={calendarHref} target="_blank" rel="noreferrer">Google Calendar</a> : null}
          {directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer">Directions</a> : null}
        </div>
      </section>

      {practice.status === 'cancelled' ? (
        <section className={styles.cancelled}><strong>This practice was cancelled.</strong></section>
      ) : (
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div>
              <p className={styles.eyebrow}>Your reply</p>
              <h2>Can you make it?</h2>
            </div>
            <span className={styles.capacity}>{practice.capacity ? `${confirmedCount}/${practice.capacity} spots` : `${confirmedCount} in`}</span>
          </div>
          <label className={styles.field}>
            <span>Your name</span>
            <select value={playerName} onChange={(event) => { setPlayerName(event.target.value); setSavedStatus(null) }}>
              <option value="">Choose your name</option>
              {data.roster.map((player) => <option key={player.id} value={player.playerName}>{player.playerName}</option>)}
            </select>
          </label>
          <div className={styles.replyGrid}>
            <button type="button" disabled={Boolean(saving)} onClick={() => void respond('in')} className={styles.inButton}>{saving === 'in' ? 'Saving...' : 'I’m in'}</button>
            <button type="button" disabled={Boolean(saving)} onClick={() => void respond('maybe')}>Maybe</button>
            <button type="button" disabled={Boolean(saving)} onClick={() => void respond('out')}>I’m out</button>
          </div>
          <label className={styles.field}>
            <span>Note <small>optional</small></span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Running late, can bring balls…" />
          </label>
          {responseHeadline ? (
            <div className={styles.success} role="status">
              <strong>{responseHeadline}</strong>
              <span>{savedStatus === 'waitlist' ? 'Your captain can see you’re next if a spot opens.' : 'Your captain has your response.'}</span>
              <a href={phoneCalendarHref}>Add practice to calendar</a>
            </div>
          ) : null}
          {error ? <div className={styles.error}>{error}</div> : null}
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div>
            <p className={styles.eyebrow}>Live roster</p>
            <h2>Who’s coming</h2>
          </div>
          <span className={styles.capacity}>{confirmedCount} confirmed</span>
        </div>
        <RosterRow label="In" names={groups.get('in') || []} tone="in" />
        {(groups.get('waitlist')?.length || 0) > 0 ? <RosterRow label="Waitlist" names={groups.get('waitlist') || []} tone="waitlist" /> : null}
        <RosterRow label="Maybe" names={groups.get('maybe') || []} />
        <details className={styles.details}>
          <summary>{groups.get('unanswered')?.length || 0} waiting · {groups.get('out')?.length || 0} out</summary>
          <RosterRow label="Waiting" names={groups.get('unanswered') || []} />
          <RosterRow label="Out" names={groups.get('out') || []} />
        </details>
      </section>

      {practice.notes ? <section className={styles.note}><p className={styles.eyebrow}>Practice focus</p><p>{practice.notes}</p></section> : null}

      <footer className={styles.footer}>
        <span>No account needed to RSVP.</span>
        <Link href="/signup">Join TenAceIQ</Link>
      </footer>
    </main>
  )
}

function RosterRow({ label, names, tone = '' }: { label: string; names: string[]; tone?: string }) {
  return (
    <div className={`${styles.rosterRow} ${tone ? styles[tone] : ''}`}>
      <strong>{label}</strong>
      <span>{names.length ? names.join(', ') : 'None yet'}</span>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (!value || Number.isNaN(date.getTime())) return 'Date to be confirmed'
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

function formatTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}
