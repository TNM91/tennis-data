'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle, MapPin } from '@phosphor-icons/react'
import { loadTiqTournamentEventRecords, type TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { buildEventDirectionsHref, buildTournamentEventPass } from '@/lib/tournament-event-pass'
import { loadEventArrivals, saveEventArrival, type EventArrival } from '@/lib/tournament-event-arrivals'
import { formatTournamentEventDate, formatTournamentEventTime } from '@/lib/tournament-event-presentation'
import styles from './tournament-event-pass.module.css'

export default function TournamentEventPass({ event, divisions, director = false, initialDivisionId = '' }: {
  event: TiqTournamentRecord; divisions: TiqTournamentRecord[]; director?: boolean; initialDivisionId?: string
}) {
  const [divisionId, setDivisionId] = useState(initialDivisionId)
  const [freshDivisions, setFreshDivisions] = useState<{ source: TiqTournamentRecord[]; data: TiqTournamentRecord[] } | null>(null)
  const shownDivisions = freshDivisions?.source === divisions ? freshDivisions.data : divisions
  const [entrant, setEntrant] = useState('')
  const [arrivals, setArrivals] = useState<EventArrival[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [arrivalError, setArrivalError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const division = shownDivisions.find(item => item.id === divisionId) || shownDivisions[0]
  const selected = division?.entrants.includes(entrant) ? entrant : ''
  const pass = useMemo(() => division && selected ? buildTournamentEventPass(division, selected) : null, [division, selected])
  const divisionIds = divisions.map(item => item.id).sort().join('\n')
  const checkedIn = arrivals.some(row => row.tournament_id === division?.id && row.entrant_name === selected && row.checked_in)
  const directions = buildEventDirectionsHref(event)
  useEffect(() => {
    let active = true
    void loadEventArrivals(divisionIds ? divisionIds.split('\n') : []).then(result => {
      if (!active) return
      setArrivals(result.data); setArrivalError(result.error ? 'Check-in status could not be loaded. Ask the event desk.' : ''); setLoading(false)
    }).catch(() => { if (active) { setArrivalError('Check-in status could not be loaded. Ask the event desk.'); setLoading(false) } })
    return () => { active = false }
  }, [divisionIds])

  async function refresh() {
    setLoading(true); setError(''); setArrivalError(''); setNotice('')
    try {
      const [result, records] = await Promise.all([loadEventArrivals(divisions.map(item => item.id)), loadTiqTournamentEventRecords(event.id)])
      if (result.error || records.error || !records.data.some(item => item.id === event.id && item.isEvent)) throw new Error('Event unavailable')
      setArrivals(result.data)
      setFreshDivisions({ source: divisions, data: records.data.filter(item => item.eventId === event.id) })
      setNotice('Event pass refreshed.')
    } catch { setArrivalError('The event pass could not be refreshed. Ask the event desk for the latest assignment.') }
    finally { setLoading(false) }
  }
  async function confirmArrival() {
    if (!division || !selected || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const row = await saveEventArrival(division.id, selected, !checkedIn)
      setArrivals(current => [...current.filter(item => item.tournament_id !== row.tournament_id || item.entrant_name !== row.entrant_name), row])
      setNotice(row.checked_in ? `${selected} checked in.` : `${selected} check-in cleared.`)
    } catch { setError('Check-in could not be saved. Try again.') }
    finally { setBusy(false) }
  }

  return <section id="event-pass" className={styles.pass} aria-labelledby={`pass-title-${event.id}`}>
    <header><div><p className={styles.eyebrow}>{director ? 'Event desk · Arrivals' : 'Your event day'}</p><h2 id={`pass-title-${event.id}`}>{director ? 'Welcome players to court.' : 'Your court. Your next match.'}</h2><p>{director ? 'Confirm arrivals for each division. Players can see their check-in status on the event pass.' : 'Choose your confirmed team or player name to open your event pass.'}</p></div><span className={styles.badge}>{event.name}</span></header>
    <div className={styles.controls}>
      <label>Division<select value={division?.id || ''} disabled={busy || loading} onChange={e => { setDivisionId(e.target.value); setEntrant(''); setNotice('') }}><option value="" disabled>Choose a division</option>{shownDivisions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>{division?.entrantType === 'teams' ? 'Confirmed team' : 'Confirmed player'}<select value={selected} disabled={busy || !division?.entrants.length} onChange={e => { setEntrant(e.target.value); setNotice('') }}><option value="">{division?.entrants.length ? 'Choose your name' : 'Confirmed entrants will appear here'}</option>{division?.entrants.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    </div>
    {!division?.entrants.length ? <p className={styles.empty}>The director hasn’t posted confirmed {division?.entrantType || 'entrants'} yet. Your pass will be available after the field is set.</p> : !pass ? <p className={styles.empty}>Select a name above to see check-in and match details.</p> : <div className={styles.ticket}>
      <div className={styles.identity}><p className={styles.eyebrow}>{division?.name}</p><h3>{pass.entrant}</h3><p className={styles.status}><CheckCircle aria-hidden="true" size={22} />{loading ? 'Checking arrival status…' : arrivalError ? 'Check-in status unavailable' : checkedIn ? 'Checked in · See you on court' : 'Check in at the event desk'}</p><p>{formatTournamentEventDate(event.startsOn)} · {formatTournamentEventTime(event.eventDetails?.startsAt)} {event.eventDetails?.timeZoneLabel || ''}</p>{director ? <button type="button" disabled={busy || loading || Boolean(arrivalError)} onClick={() => void confirmArrival()}>{busy ? 'Saving…' : checkedIn ? 'Clear check-in' : 'Confirm arrival'}</button> : <p className={styles.note}>Choosing a name opens the pass. The event desk confirms check-in.</p>}</div>
      <div className={styles.match}><p className={styles.eyebrow}>{pass.champion ? 'Division champion':'Next match'}</p><h3>{pass.next ? pass.next.ready===false ? 'Opponent to be confirmed':`vs ${pass.opponent}` : pass.champion ? 'You’re the champion' : pass.runComplete ? 'Your run is complete':pass.finished ? 'Event complete' : 'Awaiting the next draw'}</h3>{pass.next ? <><p>{pass.next.label}</p>{pass.next.ready===false ? <p>{pass.opponent} will be decided by the earlier results.</p>:null}<dl><div><dt>Court</dt><dd>{pass.next.assigned ? pass.next.court : 'Assignment pending'}</dd></div><div><dt>Start</dt><dd>{pass.next.assigned ? formatTournamentEventTime(pass.next.time) : 'Time pending'}</dd></div></dl>{pass.next.assigned ? <p>{formatTournamentEventDate(pass.next.date, true)} {event.eventDetails?.timeZoneLabel || ''}</p> : <p>The director will post the court and start time here.</p>}</> : <p>{pass.champion ? 'Well played. Follow your division for awards.':pass.runComplete ? 'Thank you for playing. Follow the championship draw and results.':pass.finished ? 'Thank you for playing. Follow your division for results and awards.' : 'Check with the event desk for your next round.'}</p>}<Link href={`/tournaments/${encodeURIComponent(division!.id)}#draw`}>View division draw <ArrowRight aria-hidden="true" /></Link></div>
    </div>}
    <footer><div><strong>{event.eventDetails?.venueName || event.locationLabel || 'Venue to be confirmed'}</strong><p>{event.eventDetails?.venueAddress || event.locationLabel}</p></div><div className={styles.actions}>{directions ? <a href={directions} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" /> Get directions</a> : null}{pass ? <button type="button" disabled={loading || busy} onClick={() => void refresh()}>Refresh event pass</button> : null}<Link href={`/tournaments/${encodeURIComponent(event.id)}`}>Event details</Link></div></footer>
    {notice ? <p role="status">{notice}</p> : null}{error || arrivalError ? <p role="alert" className={styles.error}>{error || arrivalError}</p> : null}
  </section>
}
