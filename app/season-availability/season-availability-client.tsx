'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/components/auth-provider'
import { buildTeamSeasonCalendars, type TeamSeasonMatch } from '@/lib/team-season-calendar'
import { appleSubscriptionUrl, googleMatchCalendarUrl, saveSeasonCalendarItems } from '@/lib/season-calendar-actions'
import { seasonMatchLabel, type SeasonReply, type SeasonReplyStatus, type SeasonScope } from '@/lib/season-kickoff'
import styles from '@/app/components/season-kickoff.module.css'

type Payload = { scope: SeasonScope; playerName: string; matches: TeamSeasonMatch[]; replies: SeasonReply[]; today: string; calendarToken: string }
const labels: Record<SeasonReplyStatus, string> = { available: 'Available', maybe: 'Not sure', unavailable: 'Unavailable' }
export default function SeasonAvailabilityClient() {
  const { session, userId } = useAuth()
  const [token, setToken] = useState('')
  const [data, setData] = useState<Payload | null>(null)
  const [statuses, setStatuses] = useState<Record<string, SeasonReplyStatus>>({})
  const [dirty, setDirty] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [calendar, setCalendar] = useState<'apple' | 'google' | null>(null)
  const [calendarMessage, setCalendarMessage] = useState('')
  const [origin, setOrigin] = useState('')
  const loadingGeneration = useRef(0)
  const lock = useRef(false)
  useEffect(() => {
    // The secret stays out of page requests/referrers. API calls are private
    // and return only this player's answers, never the rest of the roster.
    setToken(window.location.hash.slice(1)); setOrigin(window.location.origin)
  }, [])
  const load = useCallback(async () => {
    if (!token) return
    const run = ++loadingGeneration.current
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/season-availability/${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(30000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Your season could not be loaded.')
      if (run !== loadingGeneration.current) return
      setData(result); setStatuses(Object.fromEntries(result.replies.map((reply: SeasonReply) => [reply.match_id, reply.status]))); setDirty([])
    } catch (cause) { if (run === loadingGeneration.current) setError(cause instanceof Error && !['TimeoutError', 'AbortError'].includes(cause.name) ? cause.message : 'Loading took too long. Please retry.') }
    finally { if (run === loadingGeneration.current) setBusy(false) }
  }, [token])
  useEffect(() => { void load(); return () => { loadingGeneration.current += 1 } }, [load])
  useEffect(() => {
    if (!dirty.length) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty.length])
  const upcoming = data?.matches.filter(match => (match.match_date || '') >= data.today) || []
  const items = data ? buildTeamSeasonCalendars(data.scope.team, data.matches, userId || 'season').flatMap(season => season.items) : []
  const feed = `${origin}/api/season-availability/${encodeURIComponent(data?.calendarToken || '')}/calendar.ics`

  function select(matchId: string, status: SeasonReplyStatus) {
    setStatuses(previous => ({ ...previous, [matchId]: status })); setDirty(previous => [...new Set([...previous, matchId])]); setMessage('')
  }
  async function save() {
    if (lock.current || !dirty.length) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const responses = upcoming.filter(match => dirty.includes(match.id)).map(match => ({ matchId: match.id, matchDate: match.match_date, matchTime: match.match_time || '', status: statuses[match.id] }))
      const response = await fetch(`/api/season-availability/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responses }), signal: AbortSignal.timeout(30000) })
      const result = await response.json()
      if (!response.ok || result.saved !== responses.length) throw new Error(result.message || 'Not all answers were saved. Please retry.')
      setDirty([]); setMessage(`${result.saved} match ${result.saved === 1 ? 'answer' : 'answers'} saved for your captain. Return to this link any time to update them.`)
    } catch (cause) { setError(cause instanceof Error && !['TimeoutError', 'AbortError'].includes(cause.name) ? cause.message : 'Saving took too long. Retry safely; your answers will not be duplicated.') }
    finally { setBusy(false); lock.current = false }
  }
  async function saveCalendar() {
    if (lock.current) return
    lock.current = true; setBusy(true); setCalendarMessage('')
    try { await saveSeasonCalendarItems(items, session?.access_token || '', () => {}); setCalendarMessage(`${items.length} matches saved to your TiQ calendar. This does not select you for a lineup.`) }
    catch (cause) { setCalendarMessage(cause instanceof Error ? cause.message : 'Calendar save failed. Please retry.') }
    finally { setBusy(false); lock.current = false }
  }
  return <main className={styles.page}>
    <section className={styles.panel}><p>TenAceIQ · Season availability</p><h1>Plan your season</h1>
      {data ? <><strong>{data.scope.team}</strong><p>{data.scope.league} · {data.scope.flight}</p><h2>Hi {data.playerName}</h2><p>Mark the dates you can play. Your captain will choose the final lineup separately. No login needed to reply.</p></> : <p>{busy ? 'Loading your season…' : 'Open the personal season link your captain sent you.'}</p>}
      {error ? <div role="alert" className={`${styles.feedback} ${styles.error}`}><p>{error}</p><button className={styles.secondary} disabled={busy} onClick={() => { if (!dirty.length || window.confirm('Reload the schedule? Unsaved changes will be discarded.')) void load() }}>Reload schedule</button></div> : null}
    </section>
    {data ? <>
      <section className={styles.panel} aria-label="Season calendar"><h2>Keep the dates handy</h2><p>Add {items.length} season matches. Adding dates does not answer your availability.</p>
        <div className={styles.actions}><button className={styles.secondary} onClick={() => setCalendar('apple')}>Apple Calendar</button><button className={styles.secondary} onClick={() => setCalendar('google')}>Google Calendar</button>
          {session ? <button className={styles.secondary} disabled={busy} onClick={() => void saveCalendar()}>Save to my TiQ calendar</button> : <Link className={styles.secondary} href="/login" target="_blank" rel="noreferrer">Sign in to save to TiQ</Link>}</div>
        {!session ? <p>Sign-in opens a new tab. Return here afterward to save these dates to your own TiQ calendar.</p> : null}
        {calendar === 'apple' ? <div className={styles.item}><h3>Finish in Apple Calendar</h3><a className={styles.button} href={appleSubscriptionUrl(feed)}>Open Apple Calendar</a><p>Follow Apple’s prompts to add this subscription. Subscribe only once to avoid duplicates. The schedule updates when your calendar app refreshes.</p></div> : null}
        {calendar === 'google' ? <div className={styles.item}><h3>Add your season to Google</h3><p>On a computer: Google Calendar → Other calendars → + → From URL. Paste this private link and choose Add calendar.</p><input aria-label="Private season calendar link" className={styles.input} readOnly value={feed} onFocus={event => event.target.select()} /><a className={styles.secondary} href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">Open Google Calendar setup</a>
          <details><summary>On your phone? Add individual matches</summary><ul className={styles.list}>{items.map(item => <li key={item.id}><a className={styles.secondary} href={googleMatchCalendarUrl(item)} target="_blank" rel="noreferrer">{item.date} · {item.title}</a></li>)}</ul><p>These are one-time copies. Confirm Save in Google. Do not add them individually if you already subscribed.</p></details></div> : null}
        {calendar ? <p>This read-only calendar link includes this season only, not your availability replies. Keep your personal reply link separate. Use TiQ’s family calendar sharing to choose exactly which matches to share.</p> : null}
        {calendarMessage ? <p role="status">{calendarMessage}</p> : null}
      </section>
      <section className={styles.panel}><div className={styles.row}><h2>{upcoming.length} upcoming matches</h2><button className={styles.secondary} disabled={busy || !upcoming.length} onClick={() => {
        setStatuses(previous => ({ ...previous, ...Object.fromEntries(upcoming.map(match => [match.id, 'available' as const])) })); setDirty(upcoming.map(match => match.id)); setMessage('')
      }}>Available for all · then adjust</button></div>
      <p>Yes = available · No = unavailable. Not sure is fine. Unanswered dates never count as Yes.</p>
      <ul className={styles.list}>{upcoming.map(match => <li className={styles.item} key={match.id}><strong>{seasonMatchLabel(match)}</strong><p>vs {match.home_team === data.scope.team ? match.away_team : match.home_team}{match.facility ? ` · ${match.facility}` : ''}</p>
        <div className={styles.statuses} role="group" aria-label={`Availability for ${match.match_date} vs ${match.home_team === data.scope.team ? match.away_team : match.home_team}`}>{(Object.keys(labels) as SeasonReplyStatus[]).map(status => <button className={styles.secondary} key={status} disabled={busy} aria-label={labels[status]} aria-pressed={statuses[match.id] === status} onClick={() => select(match.id, status)}>{status === 'available' ? 'Yes' : status === 'unavailable' ? 'No' : 'Not sure'}</button>)}</div>
        <p>{dirty.includes(match.id) ? 'Unsaved change' : statuses[match.id] ? `Saved: ${labels[statuses[match.id]]}` : 'Unanswered'}</p>
      </li>)}</ul>
      {!upcoming.length ? <p>There are no upcoming matches in this season.</p> : null}</section>
      <div className={styles.saveBar}><p role="status">{message || (dirty.length ? `${dirty.length} unsaved changes` : 'Choose a response for the dates you know.')}</p><button className={styles.button} disabled={busy || !dirty.length} onClick={() => void save()}>{busy ? 'Please wait…' : 'Save availability'}</button></div>
    </> : null}
  </main>
}
