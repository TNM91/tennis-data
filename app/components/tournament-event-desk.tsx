'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarBlank, CheckCircle, Clock, WarningCircle } from '@phosphor-icons/react'
import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { buildEventDeskMatches, buildEventDivisionReadiness, findEventCourtOverlaps, isCompleteEventSlot, type EventDeskMatch } from '@/lib/tournament-event-desk'
import { formatTournamentEventDate, formatTournamentEventTime } from '@/lib/tournament-event-presentation'
import styles from './tournament-event-desk.module.css'
import TournamentEventPass from './tournament-event-pass'
import TournamentEventChampionship from './tournament-event-championship'
import TournamentEventRegistration from './tournament-event-registration'
import TournamentEventRunSheet from './tournament-event-run-sheet'
import TournamentEventNextOnCourt from './tournament-event-next-on-court'
import TournamentEventScheduleNotices from './tournament-event-schedule-notices'

export type EventCourtAssignment = { divisionId: string; matchId: string; date: string; time: string; court: string }

type Props = {
  event: TiqTournamentRecord
  divisions: TiqTournamentRecord[]
  onManage: (division: TiqTournamentRecord, section: string) => void
  onScheduleSave: (assignment: EventCourtAssignment) => Promise<string>
  onRegistrationsChanged: (divisionId: string) => Promise<void>
}

export default function TournamentEventDesk({ event, divisions, onManage, onScheduleSave, onRegistrationsChanged }: Props) {
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [view, setView] = useState<'all' | 'unassigned' | 'conflicts'>('all')
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [editing, setEditing] = useState<EventDeskMatch | null>(null)
  const [slot, setSlot] = useState({ date: '', time: '', court: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const matches = useMemo(() => buildEventDeskMatches(divisions), [divisions])
  const overlaps = useMemo(() => findEventCourtOverlaps(matches, windowMinutes), [matches, windowMinutes])
  const conflictKeys = new Set(overlaps.flatMap(pair => [pair.first.key, pair.second.key]))
  const completed = matches.filter(match => match.completed).length
  const assigned = matches.filter(match => match.assigned).length
  const unassigned = matches.filter(match => !match.assigned && !match.completed).length
  const totalEntrants = divisions.reduce((count, division) => count + division.entrants.length, 0)
  const readyDivisions = divisions.filter(division => buildEventDivisionReadiness(division, matches).ready).length
  const visible = matches.filter(match => (divisionFilter === 'all' || match.divisionId === divisionFilter)
    && (view === 'all' || (view === 'unassigned' ? !match.assigned && !match.completed : conflictKeys.has(match.key))))
  const draft = editing ? { ...editing, ...slot, assigned: isCompleteEventSlot(slot) } : null
  const draftOverlaps = draft ? findEventCourtOverlaps(matches.map(match => match.key === draft.key ? draft : match), windowMinutes)
    .filter(pair => pair.first.key === draft.key || pair.second.key === draft.key) : []

  function edit(match: EventDeskMatch) {
    setEditing(match)
    setSlot({ date: match.date || event.startsOn, time: match.time || event.eventDetails?.startsAt || '', court: match.court })
    setMessage(''); setError('')
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' })
      editorRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    })
  }

  async function save(assignment: EventCourtAssignment) {
    setSaving(true); setMessage(''); setError('')
    try {
      setMessage(await onScheduleSave(assignment))
      setEditing(null)
    } catch {
      setError('The court assignment could not be saved. Your changes are still here. Try again.')
    } finally { setSaving(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || saving) return
    if (!isCompleteEventSlot(slot)) { setError('Choose a valid date, start time, and court.'); return }
    await save({ divisionId: editing.divisionId, matchId: editing.matchId, ...slot })
  }

  return <section className={styles.desk} aria-label={`${event.name} organizer overview`}>
    <header className={styles.header}>
      {event.eventTheme === 'pumpkin' ? <Image src="/media/tournaments/pumpkin-playoffs-night-session-v1.webp" alt="" fill sizes="100vw" className={styles.art} unoptimized /> : null}
      <div className={styles.headerCopy}><p className={styles.eyebrow}>Event desk <span>· {event.isPublic ? 'Public event' : 'Private draft'}</span></p>
        <h2>{event.name}</h2><p className={styles.eventFacts}><CalendarBlank size={17} aria-hidden="true" /> {formatTournamentEventDate(event.startsOn)} <span>·</span> {formatTournamentEventTime(event.eventDetails?.startsAt)} <span>·</span> {event.eventDetails?.venueName || event.locationLabel || 'Venue to be confirmed'}</p>
        <div className={styles.headerActions}><button type="button" onClick={() => onManage(event, 'tournament-setup')}>Edit event details</button><Link href={`/tournaments/${encodeURIComponent(event.id)}`}>Preview event <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </header>
    <dl className={styles.metrics}>
      <div><dt>Confirmed {divisions.every(division => division.entrantType === 'teams') ? 'teams' : 'entrants'}</dt><dd>{totalEntrants}</dd><small>Across {divisions.length} divisions</small></div>
      <div><dt>Court assignments</dt><dd>{assigned}<span> / {matches.length}</span></dd><small>{unassigned ? `${unassigned} still to assign` : matches.length ? 'Every match has a slot' : 'Draws pending'}</small></div>
      <div><dt>Match progress</dt><dd>{completed}<span> / {matches.length}</span></dd><small>{matches.length ? `${matches.length - completed} matches remaining` : 'Add teams to build draws'}</small></div>
      <div><dt>Divisions scheduled</dt><dd>{readyDivisions}<span> / {divisions.length}</span></dd><small>{overlaps.length ? `${overlaps.length} court overlap${overlaps.length === 1 ? '' : 's'} to review` : 'Shared court planning'}</small></div>
    </dl>
    <TournamentEventScheduleNotices event={event} divisions={divisions} />
    <TournamentEventNextOnCourt eventId={event.id} matches={matches} divisions={divisions} conflictKeys={conflictKeys} onEdit={edit} onManage={onManage} disabled={saving} />
    <div className={styles.readiness}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Next moves</p><h3>Every division, at a glance.</h3></div><span className={styles.count}>{divisions.length} divisions</span></div>
      <div className={styles.divisions}>
        {divisions.map(division => {
          const readiness = buildEventDivisionReadiness(division, matches)
          const conflicts = matches.filter(match => match.divisionId === division.id && conflictKeys.has(match.key)).length
          return <article key={division.id} className={styles.division}>
            <div className={styles.divisionTop}><h4>{division.name}</h4><span className={conflicts ? styles.warning : readiness.ready ? styles.ready : styles.pending}>{conflicts ? 'Court overlap' : readiness.completed && readiness.completed === readiness.total ? 'Results complete' : readiness.ready ? 'Courts assigned' : 'Needs attention'}</span></div>
            <p>{division.entrants.length} confirmed {division.entrantType} <span>·</span> {readiness.assigned}/{readiness.total} slots <span>·</span> {readiness.completed}/{readiness.total} results</p>
            <div className={styles.progress} role="progressbar" aria-label={`${division.name} results`} aria-valuemin={0} aria-valuemax={readiness.total || 1} aria-valuenow={readiness.completed}><span style={{ width: `${readiness.total ? readiness.completed / readiness.total * 100 : 0}%` }} /></div>
            <button type="button" disabled={saving} onClick={() => {
              const target = matches.find(match => match.divisionId === division.id && (conflicts ? conflictKeys.has(match.key) : !match.assigned && !match.completed))
              if (target && (conflicts || readiness.next.kind === 'schedule')) edit(target)
              else onManage(division, readiness.next.section)
            }}>{conflicts ? 'Resolve court overlap' : readiness.next.label} <ArrowRight size={16} aria-hidden="true" /></button>
          </article>
        })}
        {!divisions.length ? <p className={styles.empty}>Add your first division below, then confirm its teams.</p> : null}
      </div>
    </div>
    <TournamentEventRegistration key={event.id} event={event} divisions={divisions} onChanged={onRegistrationsChanged} onManage={onManage} courtActions={<>
      <button type="button" disabled={saving || !matches.some(match => !match.completed && match.ready !== false && !match.assigned)} onClick={() => { const target = matches.find(match => !match.completed && match.ready !== false && !match.assigned); if (target) edit(target) }}><span>Playable matches without a court</span><strong>{matches.filter(match => !match.completed && match.ready !== false && !match.assigned).length}</strong><small>Assign the next match</small></button>
      <button type="button" disabled={saving || !overlaps.length} onClick={() => edit(overlaps[0].first)}><span>Court overlaps</span><strong>{overlaps.length}</strong><small>Review the first overlap</small></button>
      {matches.some(match => !match.completed && match.ready === false) ? <p>Later matches await players or qualifying results. Review qualification as group play finishes.</p> : null}
    </>} />
    <section className={styles.schedule} aria-label="Shared event court schedule">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Court plan</p><h3>One schedule. Every division.</h3><p>Assign start times and courts without leaving the event.</p></div><label className={styles.window}>Planning window<select value={windowMinutes} onChange={event => setWindowMinutes(Number(event.target.value))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label></div>
      <p className={styles.windowNote}>Overlap warnings use a {windowMinutes}-minute planning window. Actual match lengths may vary.</p>
      <div className={styles.toolbar}><div className={styles.filters} aria-label="Schedule view">
        {(['all', 'unassigned', 'conflicts'] as const).map(value => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value === 'all' ? 'All matches' : value === 'unassigned' ? `Unassigned (${unassigned})` : `Overlaps (${overlaps.length})`}</button>)}
      </div><label className={styles.filterLabel}><span className={styles.srOnly}>Filter schedule by division</span><select value={divisionFilter} onChange={event => setDivisionFilter(event.target.value)}><option value="all">All divisions</option>{divisions.map(division => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label></div>
      <div className={styles.scheduleGrid}>
        <div className={styles.timeline}>
          {visible.map((match, index) => <div key={match.key}>
            {(index === 0 || (match.assigned ? match.date : '') !== (visible[index - 1].assigned ? visible[index - 1].date : '')) ? <h4 className={styles.dateHeading}>{match.assigned ? formatTournamentEventDate(match.date, true) : 'Awaiting assignment'}</h4> : null}
            <button type="button" disabled={saving} className={`${styles.match} ${editing?.key === match.key ? styles.selected : ''}`} onClick={() => edit(match)} aria-label={`Edit schedule for ${match.sideA} vs ${match.sideB} in ${match.divisionName}, ${match.label}`}>
              <span className={styles.matchTime}>{match.assigned ? formatTournamentEventTime(match.time) : 'Not assigned'}<small>{match.court ? (/^court\b/i.test(match.court) ? match.court : `Court ${match.court}`) : 'Choose a court'}</small></span>
              <span className={styles.matchDetails}><span className={styles.divisionName}>{match.divisionName} <span>· {match.label}</span></span><strong>{match.sideA} <span>vs</span> {match.sideB}</strong></span>
              <span className={conflictKeys.has(match.key) ? styles.warning : match.completed ? styles.ready : styles.matchAction}>{conflictKeys.has(match.key) ? <><WarningCircle aria-hidden="true" size={16} /> Overlap</> : match.completed ? <><CheckCircle aria-hidden="true" size={16} /> Complete</> : <><Clock aria-hidden="true" size={16} /> Edit slot</>}</span>
            </button>
          </div>)}
          {!visible.length ? <div className={styles.empty}><CalendarBlank size={28} aria-hidden="true" /><h4>{!matches.length ? 'Your court plan starts with the draw.' : view === 'conflicts' ? 'No overlaps in this view.' : view === 'unassigned' ? 'Every match in this view has a slot.' : 'No matches in this division.'}</h4><p>{!matches.length ? 'Add at least two confirmed teams to a division, then assign its matches here.' : 'Use the filters above to see the rest of the event.'}</p>{!matches.length && divisions[0] ? <button type="button" onClick={() => onManage(divisions[0], 'tournament-setup')}>Add confirmed teams <ArrowRight size={16} aria-hidden="true" /></button> : null}</div> : null}
        </div>
        <div ref={editorRef} className={styles.editor}>
          {editing ? <form onSubmit={submit}>
            <p className={styles.eyebrow}>Court assignment</p><h4>{editing.label}</h4><p className={styles.editorSubtitle}>{editing.divisionName}</p><p className={styles.pairing}>{editing.sideA} <span>vs</span> {editing.sideB}</p>
            <label>Date<input type="date" value={slot.date} required disabled={saving} onChange={event => setSlot({ ...slot, date: event.target.value })} /></label>
            <label>Start time<input type="time" value={slot.time} required disabled={saving} onChange={event => setSlot({ ...slot, time: event.target.value })} /></label>
            <label>Court<input value={slot.court} maxLength={80} required disabled={saving} placeholder="e.g. 1 or Center Court" onChange={event => setSlot({ ...slot, court: event.target.value })} /></label>
            {draftOverlaps.length ? <div className={styles.overlapNotice} role="status"><strong><WarningCircle size={17} aria-hidden="true" /> This slot overlaps</strong>{draftOverlaps.map(pair => {
              const other = pair.first.key === editing.key ? pair.second : pair.first
              return <p key={other.key}>{other.divisionName} · {other.label} at {formatTournamentEventTime(other.time)}.</p>
            })}<p>Choose another court or start time, or save this overlap for review.</p></div> : null}
            <button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving…' : draftOverlaps.length ? 'Save overlapping slot' : 'Save court assignment'}</button>
            <div className={styles.editorActions}><button type="button" disabled={saving} onClick={() => { setEditing(null); setError('') }}>Cancel</button>{editing.date || editing.time || editing.court ? <button type="button" disabled={saving} onClick={() => void save({ divisionId: editing.divisionId, matchId: editing.matchId, date: '', time: '', court: '' })}>Clear assignment</button> : null}</div>
          </form> : <><p className={styles.eyebrow}>Quick assignment</p><h4>Keep play moving.</h4><p className={styles.editorSubtitle}>Select a match to change its court or start time. All divisions share this court plan.</p>{overlaps.length ? <button type="button" className={styles.primary} onClick={() => edit(overlaps[0].first)}>Review first overlap <ArrowRight size={16} aria-hidden="true" /></button> : matches.find(match => !match.assigned && !match.completed) ? <button type="button" className={styles.primary} onClick={() => edit(matches.find(match => !match.assigned && !match.completed)!)}>Assign next match <ArrowRight size={16} aria-hidden="true" /></button> : <p className={styles.editorNote}>{matches.length ? 'Court assignments are up to date.' : 'Matches appear after teams are confirmed.'}</p>}</>}
          {message ? <p role="status" className={styles.success}>{message}</p> : null}
          {error ? <p role="alert" className={styles.overlapNotice}>{error}</p> : null}
        </div>
      </div>
    </section>
    <TournamentEventRunSheet event={event} divisions={divisions} windowMinutes={windowMinutes} />
    <TournamentEventChampionship key={event.id} event={event} divisions={divisions} onManage={onManage} />
    <TournamentEventPass key={event.id} event={event} divisions={divisions} director />
  </section>
}
