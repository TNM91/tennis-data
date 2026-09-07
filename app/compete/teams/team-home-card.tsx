'use client'

import Link from 'next/link'
import styles from './teams-home.module.css'

export type TeamHomeCardProps = {
  name: string; league?: string | null; flight?: string | null; isDefault: boolean
  teamHref: string; chatHref: string; lineupHref?: string; availabilityHref?: string
  nextMatch?: { date: string; opponent: string } | null
  historyCount?: number; syncing?: boolean
  onMakeDefault?: () => void; savingDefault?: boolean; defaultDisabled?: boolean
}

export default function TeamHomeCard(props: TeamHomeCardProps) {
  const date = props.nextMatch ? new Date(`${props.nextMatch.date}T12:00:00`) : null
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null
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
    <nav className={styles.cardActions} aria-label={`${props.name} team tools`}>
      <Link className={styles.primaryAction} href={props.teamHref} aria-label={`Open ${props.name} roster and schedule`}>Roster & schedule <span aria-hidden="true">→</span></Link>
      <Link href={props.chatHref}>Team Chat</Link>
      <Link href={`${props.teamHref}#team-schedule`}>Season calendar</Link>
      {props.availabilityHref ? <Link href={props.availabilityHref}>Season availability</Link> : null}
      {props.lineupHref ? <Link href={props.lineupHref}>Build lineup</Link> : null}
    </nav>
    {props.onMakeDefault ? <div className={styles.cardFooter}><span>Choose which team opens first.</span><button type="button" onClick={props.onMakeDefault} disabled={props.defaultDisabled}>{props.savingDefault ? 'Saving…' : 'Make default'}</button></div> : null}
  </article>
}
