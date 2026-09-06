'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { buildTeamSeasonCalendars, type TeamSeasonMatch } from '@/lib/team-season-calendar'
import { buildTennisCalendarFeed } from '@/lib/tiq-league-schedule-calendar'
import styles from './team-season-calendar.module.css'

type Props = {
  team: string
  matches: TeamSeasonMatch[]
  userId: string
  accessToken: string
  importHref: string
  incomplete?: boolean
}

export default function TeamSeasonCalendar({ team, matches, userId, accessToken, importHref, incomplete = false }: Props) {
  const seasons = useMemo(() => buildTeamSeasonCalendars(team, matches, userId), [team, matches, userId])
  const [selectedKey, setSelectedKey] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [timeZone, setTimeZone] = useState('America/Chicago')
  const season = seasons.find((item) => item.key === selectedKey) || seasons[0]
  const items = season?.items || []
  const matchLabel = items.length === 1 ? 'match' : 'matches'

  async function save() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      // The existing account calendar accepts at most 100 items per request.
      for (let offset = 0; offset < items.length; offset += 100) {
        const batch = items.slice(offset, offset + 100)
        const response = await fetch('/api/player/calendar-items', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }),
          signal: AbortSignal.timeout(30000),
        })
        const result = await response.json()
        if (!response.ok || !result.ok || result.savedCount !== batch.length) throw new Error(result.message || 'Some dates could not be saved. Retry to finish adding this season.')
      }
      setMessage(`${items.length} ${matchLabel} saved to your TiQ calendar. Use phone sync below to see them on your iPhone too.`)
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'Saving took too long. Retry to finish adding this season.')
    } finally {
      setSaving(false)
    }
  }

  function download() {
    const ics = buildTennisCalendarFeed(items, { calendarName: `${team} · ${season?.label || 'Season'}`, timeZone, durationMinutes: 120 })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'TenAceIQ-team-season.ics'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    setMessage('Calendar file prepared. Open it in your calendar app to finish adding the season. This copy will not update automatically.')
  }

  return (
    <section id="team-schedule" className={styles.card} aria-label="Team season calendar">
      <div className={styles.header}>
        <div><p className={styles.eyebrow}>Season schedule</p><h2>Your matches, on your calendar.</h2><p>{items.length ? `${items.length} dated ${matchLabel} · ${season.label}` : 'Bring your team dates into TiQ and your phone calendar.'}</p></div>
        <button type="button" className={styles.primary} aria-expanded={open} aria-controls="team-season-options" onClick={() => setOpen(!open)}>Add season to calendar</button>
      </div>
      {open ? <div id="team-season-options" className={styles.options}>
        {incomplete ? <p role="alert">This team has more matches than this view can show. Open your imported season below to add its complete schedule.</p> : null}
        {items.length && !incomplete ? <>
          {seasons.length > 1 ? <label>Choose season<select value={season.key} disabled={saving} onChange={(event) => { setSelectedKey(event.target.value); setMessage(''); setError('') }}>{seasons.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label> : null}
          <p>Includes all {items.length} dated {matchLabel} in this season. Adding a match does not confirm your availability.</p>
          {items.some((item) => !item.time) ? <p>Matches without a confirmed time will appear as all-day events.</p> : null}
          {accessToken ? <button type="button" className={styles.primary} disabled={saving} onClick={() => void save()}>{saving ? 'Saving season…' : `Add ${items.length} ${matchLabel} to TiQ`}</button> : <Link className={styles.primary} href="/login">Sign in to add to TiQ</Link>}
          <Link className={styles.secondary} href="/mylab#my-calendar">iPhone / Google calendar sync</Link>
          <p>Save to TiQ first, then subscribe from My Calendar. Already subscribed? Your calendar app will pick up the added dates when it refreshes.</p>
          <details><summary>Download a one-time calendar file</summary><div className={styles.download}>
            <label>Match time zone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
              <option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Phoenix">Arizona</option><option value="America/Los_Angeles">Pacific</option><option value="America/Anchorage">Alaska</option><option value="Pacific/Honolulu">Hawaii</option>
            </select></label>
            <button type="button" className={styles.secondary} onClick={download}>Download season (.ics)</button>
            <p>For Apple, Google, or Outlook. A downloaded copy will not sync later changes.</p>
          </div></details>
          <details><summary>Preview {items.length} {matchLabel}</summary><ul className={styles.matches}>{items.map((item) => <li key={item.id}><strong>{item.date} · {item.time || 'Time TBD'}</strong><span>{item.title}</span>{item.location ? <span>{item.location}</span> : null}</li>)}</ul></details>
        </> : <><p>Upload your TennisLink match schedule, or open My Calendar for dates from your approved TiQ league entries.</p><Link className={styles.primary} href={importHref}>Upload team schedule</Link><Link className={styles.secondary} href="/mylab#my-calendar">Open My Calendar</Link></>}
        {message ? <p role="status">{message}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </div> : null}
    </section>
  )
}
