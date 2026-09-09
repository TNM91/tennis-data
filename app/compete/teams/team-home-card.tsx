'use client'

import Link from 'next/link'
import styles from './teams-home.module.css'
import type { ReactNode } from 'react'
import type { CaptainLineupDraftSummary } from '@/lib/captain-lineup-draft-summary'

export type TeamLineupContinuation = CaptainLineupDraftSummary & { href: string }

export type TeamHomeCardProps = {
  name: string; league?: string | null; flight?: string | null; isDefault: boolean
  teamHref: string; chatHref: string; lineupHref?: string; availabilityHref?: string; practiceHref?: string
  nextMatch?: { date: string; opponent: string } | null
  historyCount?: number; syncing?: boolean
  availabilitySummary?: ReactNode
  lineupContinuation?: TeamLineupContinuation | null
  onMakeDefault?: () => void; savingDefault?: boolean; defaultDisabled?: boolean
}

export default function TeamHomeCard(props: TeamHomeCardProps) {
  const date = props.nextMatch ? new Date(`${props.nextMatch.date}T12:00:00`) : null
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null
  const continuation = props.lineupContinuation
  const continuationProgress = continuation?.requiredPlayers
    ? Math.round((continuation.assignedPlayers / continuation.requiredPlayers) * 100)
    : 0
  const lineupCourtsReady = Boolean(
    continuation
    && continuation.assignedPlayers >= continuation.requiredPlayers
    && continuation.completedCourts >= continuation.totalCourts,
  )
  const lineupSent = continuation?.deliveryStatus === 'sent'
  return <article className={`${styles.teamCard} ${props.isDefault ? styles.defaultCard : ''}`} aria-label={props.name}>
    <header className={styles.cardHeader}>
      <div className={styles.cardStatus}><span>{props.isDefault ? 'Default team' : 'Connected team'}</span>{props.flight ? <span className={styles.flight}>{props.flight}</span> : null}</div>
      <h2><Link href={props.teamHref}>{props.name}</Link></h2>
      {props.league ? <p className={styles.league}>{props.league}</p> : null}
    </header>
    <Link href={`${props.teamHref}#team-schedule`} className={styles.nextMatch} aria-label={`${props.name}: ${props.nextMatch ? 'view next match' : 'open schedule'}`}>
      {validDate ? <time className={styles.dateTile} dateTime={props.nextMatch!.date}><span>{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(validDate)}</span><strong>{validDate.getDate()}</strong></time> : <span className={styles.dateTile} aria-hidden="true">—</span>}
      <span className={styles.nextCopy}><span className={styles.eyebrow}>Next match</span><strong>{props.nextMatch ? `vs ${props.nextMatch.opponent}` : props.syncing ? 'Schedule syncing' : 'No upcoming match listed'}</strong><span>{validDate ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(validDate) : props.historyCount ? `${props.historyCount} matches in history · View schedule` : 'Open your schedule and calendar'}</span></span>
      <span aria-hidden="true" className={styles.arrow}>↗</span>
    </Link>
    {continuation ? (
      <Link href={continuation.href} className={`${styles.lineupContinuation} ${continuation.status === 'final' ? styles.finalLineup : ''}`}>
        <span className={styles.lineupContinuationHeader}>
          <span className={styles.lineupContinuationEyebrow}>{lineupSent ? 'Sent to team' : continuation.status === 'final' ? 'Lineup confirmed' : lineupCourtsReady ? 'Lineup saved' : 'Lineup in progress'}</span>
          <span>{lineupSent ? formatSentAt(continuation.deliveredAt) : formatSavedAt(continuation.updatedAt)}</span>
        </span>
        <strong className={styles.lineupContinuationMatch}>
          {continuation.opponentTeam ? `vs ${continuation.opponentTeam}` : 'Opponent not set'}
          {continuation.matchDate ? ` · ${formatShortDate(continuation.matchDate)}` : ''}
        </strong>
        <progress value={continuationProgress} max={100} aria-label={`${continuation.assignedPlayers} of ${continuation.requiredPlayers} lineup spots selected`} />
        <span className={styles.lineupContinuationFooter}>
          <span>{continuation.assignedPlayers}/{continuation.requiredPlayers} selected · {continuation.completedCourts}/{continuation.totalCourts} courts set</span>
          <strong>{lineupSent ? 'View sent lineup →' : continuation.status === 'final' ? 'Share lineup →' : lineupCourtsReady ? 'Review replies →' : 'Resume →'}</strong>
        </span>
      </Link>
    ) : null}
    {props.availabilitySummary}
    <nav className={styles.cardActions} aria-label={`${props.name} team tools`}>
      {props.lineupHref ? <Link className={styles.primaryAction} href={props.lineupHref}>{continuation ? lineupSent ? 'View sent lineup' : continuation.status === 'final' ? 'Share confirmed lineup' : lineupCourtsReady ? 'Review lineup' : 'Resume lineup' : 'Build lineup'} <span aria-hidden="true">→</span></Link> : null}
      {props.availabilityHref ? <Link href={props.availabilityHref} className={styles.availabilityAction}>Season availability</Link> : null}
      {props.practiceHref ? <Link href={props.practiceHref} className={styles.practiceAction}>Plan practice</Link> : null}
      <Link className={props.lineupHref ? undefined : styles.primaryAction} href={props.teamHref} aria-label={`Open ${props.name} roster and schedule`}>Roster & schedule</Link>
      <Link href={props.chatHref}>Team Chat</Link>
      <Link className={props.lineupHref ? styles.calendarAction : undefined} href={`${props.teamHref}#team-schedule`}>Season calendar</Link>
    </nav>
    {props.onMakeDefault ? <div className={styles.cardFooter}><span>Choose which team opens first.</span><button type="button" onClick={props.onMakeDefault} disabled={props.defaultDisabled}>{props.savingDefault ? 'Saving…' : 'Make default'}</button></div> : null}
  </article>
}

function formatShortDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day))
}

function formatSavedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved in TiQ'
  return `Saved ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`
}

function formatSentAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sent in TiQ'
  return `Sent ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`
}
