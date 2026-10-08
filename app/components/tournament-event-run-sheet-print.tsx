'use client'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { EventRunSheet } from '@/lib/tournament-event-run-sheet'
import { formatTournamentEventDate, formatTournamentEventTime } from '@/lib/tournament-event-presentation'
import styles from './tournament-event-run-sheet.module.css'
export default function EventRunSheetPrint({ sheet, onClose }: { sheet: EventRunSheet; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const event = sheet.event
  const zone = event.eventDetails?.timeZoneLabel || event.eventDetails?.timeZone || 'Event local time'
  const table = (matches: EventRunSheet['pending']) => <table><thead><tr><th>Start / round</th><th>Division / matchup</th><th>Check-in / result</th><th>Staff notes</th></tr></thead><tbody>{matches.map(match => <tr key={match.key}><td>{match.assigned ? `${formatTournamentEventDate(match.date, true)} · ${formatTournamentEventTime(match.time)}` : 'Unassigned'}<br/><small>{match.label}</small></td><td><small>{match.divisionName}</small><br/><strong>{match.sideA}</strong><br/>vs {match.sideB}</td><td>{match.arrivalLabel}<br/>{match.completed ? `${match.winner} won${match.score ? ` · ${match.score}` : ''}` : match.status}{match.overlap ? <><br/><strong>COURT OVERLAP — REVIEW</strong></> : null}</td><td className={styles.staffNotes}>________________<br/>________________</td></tr>)}</tbody></table>
  return createPortal(<dialog ref={dialog} className={styles.printView} aria-labelledby="event-run-sheet-print-title" onClose={onClose}>
    <div className={styles.printActions}><button type="button" onClick={onClose}>Back to event desk</button><button type="button" onClick={() => window.print()}>Print / Save as PDF</button><p>This is a snapshot. Prepare a new copy after schedule or check-in changes.</p></div>
    <article><header><p className={styles.paperEyebrow}>TenAceIQ · Event-day run sheet</p><h1 id="event-run-sheet-print-title">{event.name}</h1><p>{formatTournamentEventDate(event.startsOn)} · {zone}</p><p>{event.eventDetails?.venueName || event.locationLabel}{event.eventDetails?.venueAddress ? ` · ${event.eventDetails.venueAddress}` : ''}</p>{event.eventDetails?.directorName ? <p>Director: {event.eventDetails.directorName}</p> : null}<p>Prepared: {sheet.preparedAt}</p></header><p className={styles.paperSummary}>{sheet.assigned}/{sheet.total} matches assigned · {sheet.checkedIn}/{sheet.confirmed} confirmed entrants checked in · {sheet.pending.length} awaiting a slot</p>
    {sheet.overlaps ? <p className={styles.paperNotice}>{sheet.overlaps} matches have a court overlap in the {sheet.windowMinutes}-minute planning window. Review before sending players to court.</p> : null}
    {sheet.courts.map(court => <section key={court.name}><h2>{court.name}</h2>{table(court.matches)}</section>)}
    {sheet.pending.length ? <section><h2>Awaiting court or start time</h2>{table(sheet.pending)}</section> : null}
    {!sheet.total ? <p className={styles.paperNotice}>No matches yet. Confirm at least two entrants in a division to prepare its court plan.</p> : null}
    <section><h2>Confirmed entrants · Check-in snapshot</h2>{sheet.roster.map(division => <section key={division.id}><h3>{division.name}</h3>{division.entrants.length ? <table className={styles.paperRoster}><thead><tr><th>Team / player</th><th>Arrival</th></tr></thead><tbody>{division.entrants.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.checkedIn ? 'Checked in' : '[ ] Check in at event desk'}</td></tr>)}</tbody></table> : <p>No confirmed entrants.</p>}</section>)}</section>
    <footer>Check the event desk for changes. Playoff names resolve after qualifying results are posted. Times use {zone}. Staff notes are for this printed copy.</footer></article>
  </dialog>, document.body)
}
