'use client'

import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { buildTeamSeasonCalendars, type TeamSeasonMatch } from '@/lib/team-season-calendar'
import { buildTennisCalendarFeed } from '@/lib/tiq-league-schedule-calendar'
import { appleSubscriptionUrl, createSeasonCalendarLink, googleMatchCalendarUrl, saveSeasonCalendarItems, type SeasonCalendarDestination } from '@/lib/season-calendar-actions'
import styles from './team-season-calendar.module.css'

type Props = { team: string; matches: TeamSeasonMatch[]; userId: string; accessToken: string; importHref: string; incomplete?: boolean; loadError?: string; onRetry?: () => void }

export default function TeamSeasonCalendar({ team, matches, userId, accessToken, importHref, incomplete = false, loadError = '', onRetry }: Props) {
  const seasons = useMemo(() => buildTeamSeasonCalendars(team, matches, userId), [team, matches, userId])
  const [selectedKey, setSelectedKey] = useState('')
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const [destination, setDestination] = useState<SeasonCalendarDestination | null>(null)
  const [timeZone, setTimeZone] = useState('America/Chicago')
  const busy = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const optionsId = useId()
  const season = seasons.find((item) => item.key === selectedKey) || seasons[0]
  const allItems = season?.items || []
  const items = allItems.filter((item) => !excludedIds.includes(item.id))
  const matchLabel = items.length === 1 ? 'match' : 'matches'

  useEffect(() => {
    const openFromLink = () => { if (window.location.hash === '#team-schedule') setOpen(true) }
    openFromLink()
    window.addEventListener('hashchange', openFromLink)
    return () => window.removeEventListener('hashchange', openFromLink)
  }, [])

  function resetFeedback() { setMessage(''); setError(''); setDestination(null) }

  async function save(nextDestination: SeasonCalendarDestination) {
    if (busy.current || incomplete || loadError) return
    busy.current = true
    setSaving(true)
    setProgress(0)
    resetFeedback()
    try {
      await saveSeasonCalendarItems(items, accessToken, setProgress)
      setMessage(`${items.length} ${matchLabel} saved to your TiQ calendar.`)
      if (nextDestination !== 'tiq' && !feedUrl) setFeedUrl(await createSeasonCalendarLink(accessToken))
      setDestination(nextDestination)
    } catch (cause) {
      setError(cause instanceof Error && !['TimeoutError', 'AbortError'].includes(cause.name) ? cause.message : 'This took too long. Retry safely to finish; saved matches will not be duplicated.')
    } finally {
      busy.current = false
      setSaving(false)
      window.requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ block: 'nearest' })
        resultRef.current?.focus({ preventScroll: true })
      })
    }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(feedUrl); setMessage('Private calendar link copied. Paste it into your calendar app.') }
    catch { setMessage('Copy the private link from the field below.') }
  }

  function download() {
    const ics = buildTennisCalendarFeed(items, { calendarName: `${team} · ${season?.label || 'Season'}`, timeZone, durationMinutes: 120 })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'TenAceIQ-team-season.ics'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    setMessage('Calendar file downloaded. Import it in your calendar app. This one-time copy will not sync later changes.')
  }

  return (
    <section id="team-schedule" className={styles.card} aria-label="Team season calendar">
      <div className={styles.header}>
        <div><p className={styles.eyebrow}>Season schedule</p><h2>Take your season with you.</h2><p>{allItems.length ? `${allItems.length} matches · ${season.label}` : 'Your team dates, in TiQ and on your phone.'}</p></div>
        <button type="button" className={open ? styles.secondary : styles.primary} aria-expanded={open} aria-controls={optionsId} onClick={() => setOpen(!open)}>{open ? 'Hide calendar options' : 'Add season to calendar'}</button>
      </div>
      {open && loadError ? <div id={optionsId} className={styles.options}>
        <p role="alert">{loadError}</p>
        <p>You do not need to upload your schedule again. Retry to load the dates already saved in TiQ.</p>
        {onRetry ? <button type="button" className={styles.primary} onClick={onRetry}>Retry schedule</button> : null}
      </div> : open ? <div id={optionsId} className={styles.options}>
        {incomplete ? <p role="alert">This view may not include the complete season. Open your uploaded schedule to add every match.</p> : null}
        {allItems.length > 0 && !incomplete ? <>
          {seasons.length > 1 ? <label>Choose season<select value={season.key} disabled={saving} onChange={(event) => { setSelectedKey(event.target.value); setExcludedIds([]); resetFeedback() }}>{seasons.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label> : null}
          <details><summary>Choose matches · {items.length} of {allItems.length} selected</summary>
            <div className={styles.selectionActions}>
              <button type="button" disabled={saving} className={styles.secondary} onClick={() => { setExcludedIds([]); resetFeedback() }}>Select all</button>
              <button type="button" disabled={saving} className={styles.secondary} onClick={() => { setExcludedIds(allItems.map((item) => item.id)); resetFeedback() }}>Clear selection</button>
            </div>
            <ul className={styles.matches}>{allItems.map((item) => <li key={item.id}>
              <label className={styles.matchChoice}><input type="checkbox" checked={!excludedIds.includes(item.id)} disabled={saving} onChange={(event) => { setExcludedIds(event.target.checked ? excludedIds.filter((id) => id !== item.id) : [...excludedIds, item.id]); resetFeedback() }} /><span><strong>{item.date} · {item.time || 'Time TBD'}</strong><span>{item.title}</span>{item.location ? <span>{item.location}</span> : null}</span></label>
              <a className={styles.textLink} href={googleMatchCalendarUrl(item)} target="_blank" rel="noopener noreferrer">Add just this match to Google</a>
            </li>)}</ul>
            <p>Individual Google events are one-time copies. Confirm Save in Google Calendar.</p>
          </details>
          <p>{items.length} {matchLabel} selected. Adding dates does not confirm your availability. Match times use Central time; dates without a time appear as all-day events.</p>
          {accessToken ? <>
            <div className={styles.destinations} aria-label="Choose your calendar">
              <button type="button" className={styles.primary} disabled={saving || !items.length} onClick={() => void save('apple')}>iPhone / Apple Calendar</button>
              <button type="button" className={styles.secondary} disabled={saving || !items.length} onClick={() => void save('google')}>Google Calendar</button>
              <button type="button" className={styles.secondary} disabled={saving || !items.length} onClick={() => void save('tiq')}>Save to TiQ only</button>
            </div>
            <p>Each option saves your selection to TiQ first. Already connected your calendar? Choose TiQ only; your calendar app will pick up the saved dates when it refreshes.</p>
          </> : <Link className={styles.primary} href="/login">Sign in to save your season</Link>}
          {saving ? <p role="status">{progress === items.length ? 'Preparing your calendar link…' : `Saving matches… ${progress} of ${items.length}`}</p> : null}
          <div ref={resultRef} tabIndex={-1} className={destination ? styles.result : undefined}>
            {message ? <p role="status">{message}</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {destination === 'tiq' ? <Link className={styles.textLink} href="/mylab#my-calendar">View My Calendar →</Link> : null}
            {destination && destination !== 'tiq' && feedUrl ? <>
              <h3>{destination === 'apple' ? 'One more step: add in Apple Calendar' : 'Finish in Google Calendar'}</h3>
              {destination === 'apple' ? <>
                <a className={styles.primary} href={appleSubscriptionUrl(feedUrl)}>Open Apple Calendar</a>
                <p>Confirm Subscribe in Apple Calendar. If nothing opens, use Safari, or in Calendar choose Calendars → Add Calendar → Add Subscription Calendar and paste the link below.</p>
              </> : <>
                <p>Google requires a computer to subscribe to a whole calendar. Copy your link, then choose Other calendars → + → From URL in Google Calendar. After adding it, turn it on in the Google Calendar app on your phone.</p>
                <a className={styles.secondary} href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noopener noreferrer">Open Google Calendar setup</a>
                <p>Only using your phone? Expand Choose matches above to add individual matches directly to Google.</p>
              </>}
              <button type="button" className={styles.secondary} onClick={() => void copyLink()}>Copy private calendar link</button>
              <label>Private subscription link<input readOnly value={feedUrl} onFocus={(event) => event.target.select()} /></label>
              <p>Keep this link private: it includes all dates in your TiQ calendar, not just this team. Adding a link does not disconnect your other devices. Subscribe only once per calendar app to avoid duplicate calendars.</p>
              <p>Your calendar app controls refresh timing. Re-save an updated uploaded schedule to TiQ to include its changes.</p>
            </> : null}
          </div>
          <details><summary>Download a one-time copy (.ics)</summary><div className={styles.download}>
            <label>Download time zone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
              <option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Phoenix">Arizona</option><option value="America/Los_Angeles">Pacific</option><option value="America/Anchorage">Alaska</option><option value="Pacific/Honolulu">Hawaii</option>
            </select></label>
            <button type="button" className={styles.secondary} disabled={!items.length || saving} onClick={download}>Download {items.length} {matchLabel}</button>
            <p>For a one-time import, not automatic updates. On iPhone, the Apple Calendar subscription above is the recommended option.</p>
          </div></details>
        </> : <><p>Upload your TennisLink match schedule, or open My Calendar for dates from your approved TiQ league entries.</p><Link className={styles.primary} href={importHref}>Upload team schedule</Link><Link className={styles.secondary} href="/mylab#my-calendar">Open My Calendar</Link></>}
      </div> : null}
    </section>
  )
}
