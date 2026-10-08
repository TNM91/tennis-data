'use client'
import { useEffect, useRef, useState } from 'react'
import { DownloadSimple, Printer } from '@phosphor-icons/react'
import { loadTiqTournamentEventRecords, type TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { loadEventArrivals } from '@/lib/tournament-event-arrivals'
import { buildEventRunSheet, buildEventRunSheetHtml, type EventRunSheet } from '@/lib/tournament-event-run-sheet'
import styles from './tournament-event-run-sheet.module.css'
import EventRunSheetPrint from './tournament-event-run-sheet-print'

export default function TournamentEventRunSheet({ event, divisions, windowMinutes }: { event: TiqTournamentRecord; divisions: TiqTournamentRecord[]; windowMinutes: number }) {
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState<EventRunSheet | null>(null)
  const [href, setHref] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const url = useRef('')
  const generation = useRef(0)
  const version = JSON.stringify([event.id, event.updatedAt, divisions.map(division => [division.id, division.updatedAt, division.entrants, division.results, division.schedule]), windowMinutes])
  useEffect(() => {
    generation.current += 1
    setHref(''); setSheet(null); setOpen(false); setBusy(false)
    if (url.current) { URL.revokeObjectURL(url.current); url.current = '' }
    return () => { generation.current += 1; if (url.current) { URL.revokeObjectURL(url.current); url.current = '' } }
  }, [version])
  async function prepare() {
    if (busy) return
    const requestGeneration = generation.current
    setBusy(true); setError(''); setHref(''); setSheet(null); setOpen(false)
    if (url.current) URL.revokeObjectURL(url.current)
    try {
      const records = await loadTiqTournamentEventRecords(event.id)
      const latest = records.data.find(record => record.id === event.id && record.isEvent)
      if (records.error || !latest) throw new Error('The event schedule could not be refreshed. Try again.')
      const own = records.data.filter(record => record.eventId === event.id)
      const arrivals = await loadEventArrivals(own.map(division => division.id))
      if (arrivals.error) throw new Error('Check-ins could not be refreshed. Try again before preparing the sheet.')
      const zone = latest.eventDetails?.timeZone || 'UTC'
      const preparedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(new Date()) + ` · ${latest.eventDetails?.timeZone ? latest.eventDetails.timeZoneLabel || zone : 'UTC'}`
      if (requestGeneration !== generation.current) return
      const next = buildEventRunSheet(latest, own, arrivals.data, preparedAt, windowMinutes)
      url.current = URL.createObjectURL(new Blob([buildEventRunSheetHtml(next)], { type: 'text/html;charset=utf-8' }))
      setSheet(next); setHref(url.current)
    } catch (cause) { if (requestGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Run sheet could not be prepared. Try again.') }
    finally { if (requestGeneration === generation.current) setBusy(false) }
  }
  return <section className={styles.panel} aria-labelledby={`run-sheet-${event.id}`}>
    <div><p className={styles.eyebrow}>For the court staff</p><h3 id={`run-sheet-${event.id}`}>Take the evening courtside.</h3><p>One printable plan for every division: courts, start times, check-ins, and playoff slots.</p></div>
    <div className={styles.actions}><button type="button" disabled={busy || !divisions.length} onClick={() => void prepare()}><Printer size={18} aria-hidden="true" />{busy ? 'Refreshing schedule and check-ins…' : sheet ? 'Prepare updated run sheet' : 'Prepare run sheet'}</button>{href ? <><button type="button" onClick={() => setOpen(true)}>Open print view <Printer size={17} aria-hidden="true" /></button><a href={href} download="event-day-run-sheet.html">Save run sheet <DownloadSimple size={17} aria-hidden="true" /></a></> : null}</div>
    {sheet ? <p className={styles.ready} role="status">Ready · {sheet.assigned}/{sheet.total} matches assigned · {sheet.checkedIn}/{sheet.confirmed} checked in. {sheet.pending.length ? `${sheet.pending.length} matches await a slot. ` : ''}{sheet.overlaps ? `${sheet.overlaps} matches have court overlaps. ` : ''}Prepared {sheet.preparedAt}. Use Print in the opened view to print or save as PDF.</p> : <p className={styles.note}>Prepare a fresh copy after changing courts, results, or arrivals. Payments and organizer notes stay off the sheet.</p>}
    {open && sheet ? <EventRunSheetPrint sheet={sheet} onClose={() => setOpen(false)} /> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
  </section>
}
