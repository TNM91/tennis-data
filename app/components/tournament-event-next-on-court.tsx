'use client'

import { useEffect, useRef, useState } from 'react'
import { loadEventArrivals, type EventArrival } from '@/lib/tournament-event-arrivals'
import { loadEventCourtStatuses, saveEventCourtStatus } from '@/lib/tournament-event-court-status-client'
import { currentCourtStatus, type CourtStatus, type EventCourtStatus } from '@/lib/tournament-event-court-status'
import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import type { EventDeskMatch } from '@/lib/tournament-event-desk'
import { buildEventCourtQueue } from '@/lib/tournament-event-next-on-court'
import { formatTournamentEventDate, formatTournamentEventTime } from '@/lib/tournament-event-presentation'
import styles from './tournament-event-next-on-court.module.css'

export default function TournamentEventNextOnCourt({ eventId, matches, divisions, conflictKeys, onEdit, onManage, disabled }: {
  eventId: string; matches: EventDeskMatch[]; divisions: TiqTournamentRecord[]; conflictKeys: Set<string>
  onEdit: (match: EventDeskMatch) => void
  onManage: (division: TiqTournamentRecord, section: string) => void
  disabled: boolean
}) {
  const [rows, setRows] = useState<EventCourtStatus[]>([])
  const [arrivals, setArrivals] = useState<EventArrival[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const generation = useRef<{ active: boolean } | null>(null)
  const divisionVersion = divisions.map(item => `${item.id}:${item.updatedAt}`).join('|')
  const divisionIds = divisions.map(item => item.id).join('|')
  useEffect(() => {
    const token = { active: true }; generation.current = token
    setLoading(true); setError(''); setNotice(''); setSaving(false)
    void Promise.all([loadEventCourtStatuses(eventId), loadEventArrivals(divisionIds ? divisionIds.split('|') : [])]).then(([statuses, attendance]) => {
      if (attendance.error) throw new Error('Check-in unavailable. Refresh before calling a match.')
      if (token.active && token === generation.current) { setRows(statuses); setArrivals(attendance.data); setLoading(false) }
    }).catch(cause => { if (token.active && token === generation.current) { setError(cause instanceof Error ? cause.message : 'Court status unavailable.'); setLoading(false) } })
    return () => { token.active = false }
  }, [eventId, divisionVersion, divisionIds, revision])
  const activeKeys = new Set(matches.filter(match => rows.some(row => currentCourtStatus(row, match) && row.status !== 'queued')).map(match => match.key))
  const queue = buildEventCourtQueue(matches, divisions, activeKeys)
  async function update(match: EventDeskMatch, status: CourtStatus) {
    if (loading || saving || error || disabled) return
    const token = generation.current
    if (!token?.active) return
    setSaving(true); setNotice('')
    try {
      const previous = rows.find(row => row.tournament_id === match.divisionId && row.match_id === match.matchId)
      const saved = await saveEventCourtStatus(eventId, match, status, previous?.updated_at)
      if (token.active && token === generation.current) { setRows(current => [...current.filter(row => row.tournament_id !== saved.tournament_id || row.match_id !== saved.match_id), saved]); setNotice(status === 'called' ? 'Match called. Confirm players are on court before marking play started.' : status === 'on_court' ? 'Match marked on court. Post the result to finish it.' : 'Call undone. Match returned to the queue.') }
    } catch (cause) { if (token.active && token === generation.current) setError(cause instanceof Error ? cause.message : 'Court status could not be saved.') }
    finally { if (token.active && token === generation.current) setSaving(false) }
  }
  return <section className={styles.panel} aria-labelledby="event-next-on-court-heading">
    <p className={styles.eyebrow}>Event night</p><h3 id="event-next-on-court-heading">Next on court</h3>
    <p className={styles.note}>The earliest unfinished, playable match on each court. Scheduled times guide the order; check in both entrants and resolve overlaps before calling players. Post the result to mark a match finished.</p>
    <button type="button" className={styles.assign} disabled={loading || saving || disabled} onClick={() => setRevision(value => value + 1)}>Refresh court status and check-in</button>
    {loading ? <p role="status" className={styles.note}>Checking court calls and arrivals…</p> : null}
    {error ? <p role="alert" className={styles.warning}>{error}</p> : null}
    {notice ? <p role="status" className={styles.note}>{notice}</p> : null}
    <div className={styles.grid}>{queue.courts.map(({ court, next, remaining }) => {
      const row = rows.find(item => currentCourtStatus(item, next))
      const status = row?.status || 'queued'
      const checkedIn = [next.sideA, next.sideB].filter(name => arrivals.some(item => item.tournament_id === next.divisionId && item.entrant_name === name && item.checked_in)).length
      const blocked = disabled || saving || loading || !!error
      return <article key={court} className={styles.card}>
      <header><h4>{/^court\b/i.test(next.court) ? next.court : `Court ${next.court}`}</h4><span>{remaining} remaining</span></header>
      <p className={styles.slot}>{formatTournamentEventDate(next.date, true)} · {formatTournamentEventTime(next.time)}</p>
      <p className={styles.division}>{next.divisionName} · {next.label}</p>
      <strong className={styles.pairing}>{next.sideA}<span>vs</span>{next.sideB}</strong>
      <p className={styles.callStatus}>{loading || error ? 'Status unavailable' : status === 'on_court' ? 'On court' : status === 'called' ? 'Called' : 'Queued'} <span>· {loading || error ? 'Check-in unavailable' : `${checkedIn}/2 entrants checked in`}</span></p>
      {!loading && !error && checkedIn < 2 ? <p className={styles.note}>Check in both entrants in the player pass before calling this match.</p> : null}
      <a href="#event-pass" className={styles.checkInLink}>Review player check-in</a>
      <div className={styles.actions}>{status === 'queued' ? <button type="button" disabled={blocked || checkedIn !== 2 || conflictKeys.has(next.key)} onClick={() => void update(next, 'called')}>Call match</button> : <>{status === 'called' ? <button type="button" disabled={blocked || checkedIn !== 2 || conflictKeys.has(next.key)} onClick={() => void update(next, 'on_court')}>Mark on court</button> : null}<button type="button" disabled={blocked} onClick={() => void update(next, 'queued')}>Undo call</button></>}</div>
      {conflictKeys.has(next.key) ? <p className={styles.warning}>Court overlap: review the slot before calling this match.</p> : null}
      <div className={styles.actions}><button type="button" disabled={disabled} onClick={() => { const division = divisions.find(item => item.id === next.divisionId); if (division) onManage(division, `tournament-match-${next.matchId}`) }}>Enter score</button><button type="button" disabled={disabled || saving || status !== 'queued'} onClick={() => onEdit(next)}>Edit court slot</button></div>
    </article>})}</div>
    {!queue.courts.length ? <p className={styles.empty}>{!matches.length ? 'Confirm the field to build your court queue.' : matches.every(match => match.completed) ? 'Every match has a posted result. Review the division champions and awards.' : 'No playable matches have court slots yet.'}</p> : null}
    {queue.unassigned.length ? <button className={styles.assign} type="button" disabled={disabled} onClick={() => onEdit(queue.unassigned[0])}>Assign next playable match · {queue.unassigned.length} without a slot</button> : null}
    {queue.awaitingPlayers ? <p className={styles.note}>{queue.awaitingPlayers} later {queue.awaitingPlayers === 1 ? 'match awaits' : 'matches await'} players or qualifying results.</p> : null}
  </section>
}
