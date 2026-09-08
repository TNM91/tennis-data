'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import SeasonGroupRequest from '@/app/components/season-group-request'
import type { SeasonScope } from '@/lib/season-kickoff'
import type { TeamSeasonMatch } from '@/lib/team-season-calendar'
import type { TeamAvailabilitySummary as Summary } from '@/lib/team-availability-summary'
import styles from './teams-home.module.css'

export type TeamAvailabilityPayload = { summary: Summary; selection: 'saved' | 'choose' | 'none'; scenarioId: string; scope: SeasonScope; match: TeamSeasonMatch; checkedAt: string; dayScopedAnswersOmitted: boolean }
type Props = { token: string; query: string; lineupHref: string; scheduleHref: string }

export default function TeamAvailabilitySummary(props: Props) {
  const [data, setData] = useState<TeamAvailabilityPayload | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(true)
  const [notice, setNotice] = useState('')
  const signature = useRef('')
  useEffect(() => {
    let active = true, running = false
    let controller: AbortController | undefined
    async function load() {
      if (running) return
      running = true; controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), 25000)
      setBusy(true)
      try {
        const response = await fetch(`/api/captain/team-availability-summary?${props.query}`, { headers: { Authorization: `Bearer ${props.token}` }, cache: 'no-store', signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.summary) throw new Error(result.message || 'Availability could not be checked.')
        if (active) {
          const nextSignature = JSON.stringify(result.summary)
          setNotice(nextSignature === signature.current ? 'Checked just now — no changes.' : 'Availability updated just now.')
          signature.current = nextSignature
          setData(result); setError('')
        }
      } catch (cause) {
        if (active) { setData(null); setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'This check took too long. Please retry.') }
      } finally { clearTimeout(timeout); running = false; if (active) setBusy(false) }
    }
    void load()
    const visible = () => { if (document.visibilityState === 'visible') void load() }
    const timer = setInterval(visible, 60000)
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [props.query, props.token, refresh])
  if (!data) return <section className={styles.availabilitySummary} aria-label="Next match availability">
    {busy ? <p role="status">Checking next-match availability…</p> : <><p role="alert">{error}</p><div className={styles.summaryTools}><button onClick={() => setRefresh(value => value + 1)}>Retry check</button><Link href={props.scheduleHref}>Open schedule</Link></div></>}
  </section>
  return <TeamAvailabilitySummaryView data={data} busy={busy} notice={notice} onRefresh={() => setRefresh(value => value + 1)} lineupHref={props.lineupHref}
    reminder={<SeasonGroupRequest scope={data.scope} matches={[data.match]} token={props.token} onPrepared={() => setRefresh(value => value + 1)} />} />
}

export function TeamAvailabilitySummaryView({ data, busy, notice = '', onRefresh, lineupHref, reminder }: { data: TeamAvailabilityPayload; busy: boolean; notice?: string; onRefresh: () => void; lineupHref: string; reminder: ReactNode }) {
  const read = data.summary
  const labels = { available: 'Available', waiting: 'No reply', maybe: 'Not sure', unavailable: 'Can’t play' }
  const sources = { player: 'Player replied', season: 'Season reply', captain: 'Confirmed by captain', saved: 'Saved availability' }
  const editHref = `${lineupHref}${lineupHref.includes('?') ? '&' : '?'}match=${encodeURIComponent(data.match.id)}${data.scenarioId ? `&scenario=${encodeURIComponent(data.scenarioId)}` : ''}#captain-lineup-courts`
  return <section className={styles.availabilitySummary} aria-label="Next match availability">
    <div className={styles.summaryHeading}><strong>Who can play?</strong><button disabled={busy} onClick={onRefresh} aria-label="Refresh next-match availability">{busy ? 'Checking…' : 'Refresh'}</button></div>
    <div className={styles.summaryCounts}>
      <span><strong>{read.available}</strong> Available</span><span><strong>{read.waiting}</strong> No reply</span><span><strong>{read.maybe}</strong> Not sure</span>
    </div>
    <p>{read.roster ? `${read.unavailable} can’t play · ${read.roster} on roster` : 'Add your roster to check who can play.'}{read.captainConfirmed ? ` · ${read.captainConfirmed} confirmed by captain` : ''}</p>
    {read.selectedWaiting?.length ? <p><strong>Saved lineup · {read.selectedWaiting.length} selected still to answer:</strong> {read.selectedWaiting.join(', ')}.</p>
      : data.selection === 'choose' ? <p>Multiple saved lineups. <Link href={editHref}>Choose yours in Builder</Link> to check selected players.</p>
      : data.selection === 'none' || !read.selectedCount ? <p>Build your lineup from available players. Eligibility is checked in Builder.</p>
      : <p>Saved lineup: no selected roster players are waiting for a reply. Review any “Not sure” or “Can’t play” answers before sending.</p>}
    {read.selectedUnmatched ? <p>{read.selectedUnmatched} selected {read.selectedUnmatched === 1 ? 'player needs' : 'players need'} a roster check in Builder.</p> : null}
    {data.dayScopedAnswersOmitted ? <p>Two matches share this date. Only fixture-specific replies are counted here.</p> : null}
    <div className={styles.summaryTools}>
      <details className={styles.summaryDetails}><summary>Remind players</summary><div className={styles.summaryExpanded}>
        <p>Choose how to ask. Nothing sends automatically.</p>{reminder}<Link className={styles.summaryLink} href={editHref}>Individual texts from lineup</Link>
      </div></details>
      <details className={styles.summaryDetails}><summary>View replies</summary><div className={styles.summaryExpanded}>
        <p>Availability helps you build; it does not confirm eligibility or finalize your lineup. Reconfirm match-day answers if the start time changes.</p>
        <ul className={styles.replyList}>{read.people.map(person => <li key={person.key}><span><strong>{person.name}</strong>{person.selected ? <small>Selected · Saved lineup</small> : null}</span><span>{labels[person.status]}{person.source && person.status !== 'waiting' ? <small>{sources[person.source]}</small> : null}</span></li>)}</ul>
      </div></details>
    </div>
    <span className={styles.summaryChecked} role="status">{busy ? 'Checking for new replies…' : notice || 'Latest check completed.'}</span>
  </section>
}
