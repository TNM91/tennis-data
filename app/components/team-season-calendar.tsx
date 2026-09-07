'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { buildTeamSeasonCalendars, formatSeasonDateRange, type TeamSeasonMatch } from '@/lib/team-season-calendar'
import { appleSubscriptionUrl, buildSeasonCalendarDownload, createSeasonCalendarLink, googleMatchCalendarUrl, saveSeasonCalendarItems, type SeasonCalendarDestination } from '@/lib/season-calendar-actions'
import styles from './team-season-calendar.module.css'
import SeasonVenueLocation, {withVenueChoice,type CalendarVenueChoice} from './season-venue-locations'
import { isStreetLocation } from '@/lib/venue-directory'
import MatchCalendarSharing from './match-calendar-sharing'

type Props = { team: string; matches: TeamSeasonMatch[]; userId: string; accessToken: string; importHref: string; incomplete?: boolean; loadError?: string; onRetry?: () => void }

export default function TeamSeasonCalendar({ team, matches, userId, accessToken, importHref, incomplete = false, loadError = '', onRetry }: Props) {
  const seasons = useMemo(() => buildTeamSeasonCalendars(team, matches, userId), [team, matches, userId])
  const [selectedKey, setSelectedKey] = useState('')
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [error, setError] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const [destination, setDestination] = useState<SeasonCalendarDestination | null>(null)
  const [timeZone, setTimeZone] = useState('America/Chicago')
  const busy = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDetailsElement>(null)
  const optionsId = useId()
  const season = seasons.find((item) => item.key === selectedKey) || seasons[0]
  const venueContext = JSON.stringify([team,season?.key || ''])
  const venueScope = JSON.stringify([userId,venueContext])
  const [venueChoices,setVenueChoices] = useState<Record<string,Record<string,CalendarVenueChoice>>>({})
  const [venueLoaded,setVenueLoaded] = useState<Record<string,Record<string,boolean>>>({})
  const onVenueChoose = useCallback((facility:string,choice:CalendarVenueChoice)=>{
    setVenueChoices(previous=>({...previous,[venueScope]:{...previous[venueScope],[facility]:choice}}))
    setMessage('');setDestination(null)
  },[venueScope])
  const onVenueLoaded = useCallback((facility:string,loaded:boolean)=>{
    setVenueLoaded(previous=>({...previous,[venueScope]:{...previous[venueScope],[facility]:loaded}}))
  },[venueScope])
  const allItems = (season?.items || []).map(item=>withVenueChoice(item,venueChoices[venueScope] || {}))
  const facilities = [...new Set(allItems.map(item=>item.facilityName || '').filter(name=>name && !isStreetLocation(name)))]
  const locationsReady = !accessToken || facilities.every(name=>venueLoaded[venueScope]?.[name])
  const items = allItems.filter((item) => !excludedIds.includes(item.id))
  const matchLabel = items.length === 1 ? 'match' : 'matches'
  const allMatchLabel = allItems.length === 1 ? 'match' : 'matches'

  useEffect(() => {
    const openFromLink = () => { if (window.location.hash === '#team-schedule') setOpen(true) }
    openFromLink()
    window.addEventListener('hashchange', openFromLink)
    return () => window.removeEventListener('hashchange', openFromLink)
  }, [])

  function resetFeedback() { setMessage(''); setCopyMessage(''); setError(''); setDestination(null) }

  async function save(nextDestination: SeasonCalendarDestination) {
    if (busy.current || incomplete || loadError || !locationsReady) return
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
    try { await navigator.clipboard.writeText(feedUrl); setCopyMessage('Link copied. Paste it into your calendar app; copying alone does not add any events.') }
    catch { setCopyMessage('Open Link details below and select the private link to copy it.') }
  }

  function download() {
    const ics = buildSeasonCalendarDownload(items, `${team} · ${season?.label || 'Season'}`, timeZone)
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

  function reviewGoogleMatches() {
    if (!reviewRef.current) return
    reviewRef.current.open = true
    reviewRef.current.scrollIntoView({ block: 'start' })
    reviewRef.current.querySelector('summary')?.focus()
  }

  return (
    <section id="team-schedule" className={styles.card} aria-label="Team season calendar">
      <div className={styles.header}>
        <div><p className={styles.eyebrow}>Season calendar</p><h2>{team}</h2><p>{allItems.length ? season.label : 'Your team dates, in TiQ and on your phone.'}</p>{allItems.length ? <p className={styles.seasonCount}><strong>{allItems.length} {allMatchLabel}</strong> · {formatSeasonDateRange(allItems)}</p> : null}</div>
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
          <p><strong>{items.length === allItems.length ? `${allItems.length > 1 ? 'All ' : ''}${allItems.length} ${allMatchLabel} selected` : `${items.length} of ${allItems.length} ${allMatchLabel} selected`}</strong>.</p>
          {accessToken && facilities.length ? <details><summary>Locations · confirm or update addresses</summary><div className={styles.download}>
            <p>Addresses in your upload stay as supplied. Confirm unfamiliar venues once for this team and season.</p>
            {facilities.map(facility=><SeasonVenueLocation key={`${venueScope}:${facility}`} facility={facility} context={venueContext} token={accessToken} disabled={saving} onChoose={onVenueChoose} onLoaded={onVenueLoaded} />)}
          </div></details>:null}
          {!locationsReady?<p role="status">Checking saved locations. If this does not finish, open Locations above to retry.</p>:null}
          <details ref={reviewRef}><summary>Review {allItems.length > 1 ? 'all ' : ''}{allItems.length} {allMatchLabel} · change selection</summary>
            <div className={styles.selectionActions}>
              <button type="button" disabled={saving} className={styles.secondary} onClick={() => { setExcludedIds([]); resetFeedback() }}>Select all</button>
              <button type="button" disabled={saving} className={styles.secondary} onClick={() => { setExcludedIds(allItems.map((item) => item.id)); resetFeedback() }}>Clear selection</button>
            </div>
            <ul className={styles.matches}>{allItems.map((item) => <li key={item.id}>
              <label className={styles.matchChoice}><input type="checkbox" checked={!excludedIds.includes(item.id)} disabled={saving} onChange={(event) => { setExcludedIds(event.target.checked ? excludedIds.filter((id) => id !== item.id) : [...excludedIds, item.id]); resetFeedback() }} /><span><strong>{item.date} · {item.time || 'Time TBD'}</strong><span>{item.title}</span>{item.location ? <span>{item.location}</span> : null}</span></label>
              <a className={styles.textLink} href={googleMatchCalendarUrl(item)} target="_blank" rel="noopener noreferrer">Add just this match to Google</a>
            </li>)}</ul>
            <p>Individual Google events are one-time copies. Confirm Save in Google Calendar. Do not add them again if you already subscribed to TiQ.</p>
          </details>
          {accessToken ? <>
            <div className={styles.destinations} aria-label="Choose your calendar">
              <button type="button" className={styles.primary} disabled={saving || !locationsReady || !items.length} onClick={() => void save('apple')}>iPhone / Apple Calendar</button>
              <button type="button" className={styles.secondary} disabled={saving || !locationsReady || !items.length} onClick={() => void save('google')}>Google Calendar</button>
              <button type="button" className={styles.secondary} disabled={saving || !locationsReady || !items.length} onClick={() => void save('tiq')}>Save to TiQ only</button>
            </div>
            <p>First we save your matches to TiQ. Then finish adding the calendar in Apple or Google.</p>
            <p>Already subscribed? Use Save to TiQ only. Subscribe just once per calendar app to avoid duplicates.</p>
          </> : <Link className={styles.primary} href="/login">Sign in to save your season</Link>}
          {saving ? <p role="status">{progress === items.length ? 'Preparing your calendar link…' : `Saving matches… ${progress} of ${items.length}`}</p> : null}
          <div ref={resultRef} tabIndex={-1} className={destination ? styles.result : undefined}>
            {message ? <p role="status" className={styles.savedMessage}>{message}</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {destination === 'tiq' ? <><p>Existing subscriptions receive these saved dates when your calendar app refreshes. You do not need another link.</p><Link className={styles.textLink} href="/mylab#my-calendar">View My Calendar →</Link></> : null}
            {destination && destination !== 'tiq' && feedUrl ? <>
              <h3>{destination === 'apple' ? 'Next: finish in Apple Calendar' : 'Next: finish in Google Calendar'}</h3>
              <p>Confirm the subscription in {destination === 'apple' ? 'Apple' : 'Google'} to finish. TiQ cannot check whether you have completed that step.</p>
              <p>This private link includes your entire TiQ calendar—not just this team. Do not share it unless you want someone to see all those dates.</p>
              {destination === 'apple' ? <>
                <a className={styles.primary} href={appleSubscriptionUrl(feedUrl)}>Open Apple Calendar</a>
                <p>Follow Apple’s prompts to add the subscription. On newer iPhones, tap Find, then Done. Older versions use Subscribe, then Add.</p>
                <details><summary>Apple Calendar did not open?</summary><p>Open this page in Safari, or copy the link below. In Calendar, choose Calendars → Add Calendar → Add Subscription Calendar, then paste it. Choose iCloud as the account if you want it on your other Apple devices.</p></details>
              </> : <>
                <ol className={styles.steps}><li>Copy your private calendar link below.</li><li>On a computer, open Google Calendar setup and paste it under From URL.</li><li>Choose Add calendar, then turn on TenAceIQ My Calendar in your phone’s Google Calendar app.</li></ol>
                <a className={styles.secondary} href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noopener noreferrer">Open Google Calendar setup</a>
                <details><summary>Only using your phone?</summary><p>Google’s app cannot subscribe to a whole calendar. You can add matches individually instead; those copies will not receive updates.</p><button type="button" className={styles.secondary} onClick={reviewGoogleMatches}>Choose individual Google matches</button></details>
              </>}
              <button type="button" className={styles.secondary} onClick={() => void copyLink()}>Copy private calendar link</button>
              {copyMessage ? <p role="status">{copyMessage}</p> : null}
              <details><summary>Link details &amp; calendar updates</summary><div className={styles.download}>
                <label>Private subscription link<input readOnly value={feedUrl} onFocus={(event) => event.target.select()} /></label>
                <p>Keep this link private: it includes all dates in your TiQ calendar, not just this team. Subscribe only once per app. Existing devices stay connected.</p>
                <p>If this team’s dates or times change, return here and choose Save to TiQ only. Verified address corrections update linked saved events automatically. Your calendar app decides when to refresh; changes may not appear immediately.</p>
                <p>Unchecking a match does not remove a previously saved event. Remove unwanted or cancelled dates from My Calendar in TiQ.</p>
                <Link className={styles.textLink} href="/mylab#my-calendar">Manage saved dates →</Link>
              </div></details>
            </> : null}
          </div>
          {accessToken ? <MatchCalendarSharing key={venueScope} team={team} seasonKey={season.key} timeZone={timeZone} itemIds={items.map(item=>item.id)} token={accessToken} disabled={saving || !locationsReady} saveMatches={async()=>{
            if(busy.current)throw new Error('Wait for your calendar save to finish.')
            busy.current=true;setSaving(true);setProgress(0)
            try{await saveSeasonCalendarItems(items,accessToken,setProgress)}finally{busy.current=false;setSaving(false)}
          }} /> : null}
          <details><summary>Calendar help &amp; download (.ics)</summary><div className={styles.download}>
            <p>Adding dates does not confirm your availability. Match times use Central time; dates without a time appear as all-day events.</p>
            <p>Already subscribed? Choose Save to TiQ only to update your saved dates without adding another subscription.</p>
            <label>Download time zone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
              <option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Phoenix">Arizona</option><option value="America/Los_Angeles">Pacific</option><option value="America/Anchorage">Alaska</option><option value="Pacific/Honolulu">Hawaii</option>
            </select></label>
            <button type="button" className={styles.secondary} disabled={!items.length || saving || !locationsReady} onClick={download}>Download {items.length} {matchLabel}</button>
            <p>For a one-time import, not automatic updates. Do not import this file if you already subscribed or added these matches individually. On iPhone, use the Apple Calendar subscription above for updates.</p>
          </div></details>
        </> : <><p>Upload your TennisLink match schedule, or open My Calendar for dates from your approved TiQ league entries.</p><Link className={styles.primary} href={importHref}>Upload team schedule</Link><Link className={styles.secondary} href="/mylab#my-calendar">Open My Calendar</Link></>}
      </div> : null}
    </section>
  )
}
