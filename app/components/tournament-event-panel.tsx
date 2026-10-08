'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CalendarBlank, Clock, Coins, EnvelopeSimple, MapPin, Note, Trophy } from '@phosphor-icons/react'
import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { getEventCourtConflicts } from '@/lib/tournament-events'
import {
  buildTournamentEventSignupHref,
  formatTournamentEventDate,
  formatTournamentEventFee,
  formatTournamentEventTime,
  isTournamentEventRegistrationClosed,
  normalizeTournamentEventDetails,
} from '@/lib/tournament-event-presentation'
import styles from './tournament-event-panel.module.css'
import TournamentEventPass from './tournament-event-pass'
import TournamentEventChampionship from './tournament-event-championship'
import TournamentEventRecap from './tournament-event-recap'

export default function TournamentEventPanel({ event, divisions, selectedId, onSelect }: {
  event: TiqTournamentRecord
  divisions: TiqTournamentRecord[]
  selectedId?: string
  onSelect?: (record: TiqTournamentRecord) => void
}) {
  const [choiceId, setChoiceId] = useState('')
  const director = Boolean(onSelect)
  const pumpkin = event.eventTheme === 'pumpkin'
  const details = normalizeTournamentEventDetails(event.eventDetails)
  const preferredId = director ? selectedId : choiceId || selectedId
  const selected = divisions.find(division => division.id === preferredId) || divisions[0]
  const Heading = director || (selectedId && selectedId !== event.id) ? 'h2' : 'h1'
  const words = event.name.trim().split(/\s+/)
  const titleFirst = pumpkin && words.length > 1 ? words.slice(0, -1).join(' ') : event.name
  const titleLast = pumpkin && words.length > 1 ? words[words.length - 1] : ''
  const startsAt = formatTournamentEventTime(details.startsAt)
  const feeTeam = formatTournamentEventFee(details.feePerTeam, details.currency)
  const feePlayer = formatTournamentEventFee(details.feePerPlayer, details.currency)
  const closed = isTournamentEventRegistrationClosed(event)
  const signupHref = buildTournamentEventSignupHref(event, selected)
  const conflicts = director ? getEventCourtConflicts(divisions) : []
  const directorFirstName = details.directorName?.split(' ')[0]
  const date = formatTournamentEventDate(event.startsOn)
  const divisionDescription = details.formatSummary || 'Open this division for its format, court schedule, and results.'
  const drawPending = divisions.length > 0 && divisions.every(division => !division.entrants.length)
  const sessionLabel = details.startsAt && Number(details.startsAt.slice(0, 2)) >= 17 ? 'Night session' : 'Autumn tennis'

  return (
    <section className={`${styles.panel} ${pumpkin ? styles.pumpkin : ''} ${director ? styles.director : ''}`} aria-label={`${event.name} event`}>
      <header className={styles.eventNav}>
        <Link href="/tournaments" className={styles.allEvents}>Events <span aria-hidden="true">/</span></Link>
        <span className={styles.breadcrumb}>{event.name}</span>
        {director ? <span className={styles.viewLabel}>{event.isPublic ? 'Public event' : 'Private draft'} · Director view</span> : <span className={styles.viewLabel}>Play more tennis</span>}
      </header>
      <div className={styles.hero}>
        {pumpkin ? <Image src="/media/tournaments/pumpkin-playoffs-night-session-v1.webp" alt="" fill unoptimized priority sizes="100vw" className={styles.heroImage} /> : null}
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Tennis event {pumpkin ? <><span aria-hidden="true">·</span> <span>{sessionLabel}</span></> : null}</p>
          <Heading className={styles.title}>{titleFirst}{titleLast ? <> <span>{titleLast}</span></> : null}</Heading>
          {details.subtitle ? <p className={styles.subtitle}>{details.subtitle}</p> : null}
          <div className={styles.heroFacts}>
            <div><CalendarBlank size={28} aria-hidden="true" /><p><strong>{date}</strong><span>{startsAt}{details.timeZoneLabel ? ` ${details.timeZoneLabel}` : ''}{details.finishLabel ? ` · ${details.finishLabel}` : ''}</span></p></div>
            <div><MapPin size={28} weight="fill" aria-hidden="true" /><p><strong>{details.venueName || event.locationLabel || 'Venue to be confirmed'}</strong>{details.venueAddress ? <span>{details.venueAddress}</span> : null}</p></div>
          </div>
          {director ? <div className={styles.directorActions}>
            <button type="button" onClick={() => onSelect?.(event)} className={styles.secondary}>Edit event details</button>
            <Link href={`/tournaments/${encodeURIComponent(event.id)}`} className={styles.textLink}>Preview event <ArrowRight aria-hidden="true" /></Link>
          </div> : null}
        </div>
      </div>
      <dl className={styles.factStrip}>
        <div><Clock size={32} aria-hidden="true" /><dt>Starts</dt><dd>{startsAt}<small>{details.finishLabel || 'Check with the director for finish time.'}</small></dd></div>
        <div><Coins size={32} aria-hidden="true" /><dt>Entry</dt><dd>{feeTeam ? `${feeTeam} per team` : feePlayer ? `${feePlayer} per player` : 'Contact the director'}<small>{feeTeam && feePlayer ? `${feePlayer} per player` : 'Confirm entry details before signing up.'}</small></dd></div>
        <div><Note size={32} aria-hidden="true" /><dt>{closed ? 'Registration' : 'Sign up by'}</dt><dd>{closed ? 'Closed' : details.registrationClosesOn ? formatTournamentEventDate(details.registrationClosesOn, true) : 'Ask the director'}<small>{event.registrationEmail ? `Sign up directly${details.directorName ? ` with ${details.directorName}` : ' with the director'}` : 'Choose a division for entry details.'}</small></dd></div>
      </dl>
      <div className={styles.registration}>
        <div className={styles.divisionArea}>
          <div className={styles.divisionHeading}><h2>{director ? 'Manage divisions' : 'Choose your division'}</h2><span>{drawPending ? 'Draw after signups' : `${divisions.length} divisions`}</span></div>
          <p className={styles.helper}>{director ? 'One event. Separate teams, draws, court schedules, scores, and awards.' : 'Select a division to see its signup details.'}</p>
          {director ? <nav aria-label="Manage event divisions" className={styles.divisionList}>
            {divisions.map(division => <button key={division.id} type="button" className={styles.divisionRow} aria-pressed={division.id === selectedId} onClick={() => onSelect?.(division)}>
              <span><strong>{division.name}</strong><small>{division.entrants.length} {division.entrantType} · {division.status === 'draft' ? 'Draw pending' : division.status}</small></span>
              <span className={styles.manageLabel}>Manage <ArrowRight size={20} aria-hidden="true" /></span>
            </button>)}
          </nav> : <fieldset className={styles.divisionList}>
            <legend className={styles.srOnly}>Event division</legend>
            {divisions.map(division => <label key={division.id} className={styles.divisionRow} data-selected={selected?.id === division.id}>
              <input type="radio" name={`event-division-${event.id}`} value={division.id} checked={selected?.id === division.id} onChange={() => setChoiceId(division.id)} />
              <span><strong>{division.name}</strong><small>{divisionDescription}</small></span>
            </label>)}
          </fieldset>}
          {!divisions.length ? <p className={styles.empty}>{director ? 'Save the event, then add its first division below.' : 'The director will post divisions here before registration opens.'}</p> : null}
          {selected && !director && selected.entrants.length >= 2 ? <Link href={`/tournaments/${encodeURIComponent(selected.id)}#draw`} className={styles.textLink}>View {selected.name} draw <ArrowRight aria-hidden="true" /></Link> : null}
        </div>
        <aside className={styles.signupPanel} aria-label={director ? 'Event readiness' : 'Division signup'} aria-live="polite" aria-atomic="true">
          <p className={styles.smallLabel}>{director ? 'Event overview' : 'Selected division'}</p>
          <h3>{director ? `${divisions.length} divisions. One event.` : selected?.name || 'Choose your division'}</h3>
          <p className={styles.fee}>{feeTeam ? `${feeTeam} per team` : feePlayer ? `${feePlayer} per player` : 'Confirm entry details with the director.'}{feeTeam && feePlayer ? ` (${feePlayer} per player)` : ''}</p>
          {director ? <>
            <p className={styles.signupHelp}>{divisions.reduce((count, division) => count + division.entrants.length, 0)} entrants across this event. Open a division to add confirmed teams or players.</p>
            <button type="button" className={styles.primary} onClick={() => onSelect?.(event)}>Edit shared event details</button>
          </> : closed ? <p className={styles.closed}>Registration is closed. You can still follow division draws and results.</p> : signupHref ? <>
            <a className={styles.primary} href={signupHref}>Sign up{directorFirstName ? ` with ${directorFirstName}` : ' with the director'} <ArrowRight size={20} aria-hidden="true" /></a>
            <p className={styles.signupHelp}>Sign up directly{details.directorName ? ` with ${details.directorName}` : ' with the director'} at <a href={signupHref}>{event.registrationEmail}</a>.</p>
            <p className={styles.signupNote}>Your email will include the selected division. Add your name{selected?.entrantType === 'teams' ? ' and your partner or team details' : ''} before sending.</p>
          </> : selected ? <Link className={styles.primary} href={`/tournaments/${encodeURIComponent(selected.id)}#enter-tournament`}>Open division signup <ArrowRight size={20} aria-hidden="true" /></Link> : <p className={styles.signupHelp}>Signup details will be available when divisions are posted.</p>}
        </aside>
      </div>
      {!director ? <TournamentEventChampionship key={`${event.id}:${selected?.id || ''}`} event={event} divisions={divisions} initialDivisionId={selected?.id} /> : null}
      {!director ? <TournamentEventRecap event={event} divisions={divisions} /> : null}
      {!director ? <TournamentEventPass key={`${event.id}:${selected?.id || ''}`} event={event} divisions={divisions} initialDivisionId={selected?.id} /> : null}
      <footer className={styles.eventFooter}>
        <div><h3><Trophy size={18} aria-hidden="true" /> Event details</h3><p>{details.hospitalitySummary || details.formatSummary || 'Check the event notes for format and match-day information.'}</p>
          {event.directorNotes ? <details className={styles.fullNotes}><summary><EnvelopeSimple size={15} aria-hidden="true" /> Full announcement and rules</summary><p>{event.directorNotes}</p></details> : null}
        </div>
        {details.sanctioningLabel ? <p>{details.sanctioningLabel}</p> : null}
        {details.sponsors?.length ? <p>Sponsored by {details.sponsors.join(' and ')}.</p> : null}
      </footer>
      {conflicts.map(conflict => <p key={conflict.slot} className={styles.conflict} role="status">Court overlap: {conflict.slot} — {conflict.names.join(', ')}. Check court assignments.</p>)}
      {!director && !closed && signupHref && selected ? <aside className={styles.mobileSignup} aria-label="Quick division signup">
        <div><strong>{selected.name}</strong><span>{feeTeam ? `${feeTeam} per team` : feePlayer ? `${feePlayer} per player` : 'Email the director'}</span></div>
        <a href={signupHref} aria-label={`Email signup for ${selected.name}`} className={styles.primary}>Sign up <ArrowRight size={18} aria-hidden="true" /></a>
      </aside> : null}
    </section>
  )
}
