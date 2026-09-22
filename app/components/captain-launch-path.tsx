'use client'

import Link from 'next/link'
import type { CaptainLaunchProgress } from '@/lib/captain-launch-progress'
import styles from './captain-quick-start.module.css'

// Keep the existing hub interface while routing to one authoritative guide.
type CaptainLaunchPathProps = {
  progress: CaptainLaunchProgress
  playerHref: string
  teamHref: string
  scheduleHref: string
  contactsHref: string
  outreachHref: string
  matchWeekHref: string
}

export default function CaptainLaunchPath({ matchWeekHref }: CaptainLaunchPathProps) {
  const match = new URL(matchWeekHref, 'https://www.tenaceiq.com')
  const query = new URLSearchParams()
  for (const field of ['team', 'league', 'flight']) {
    const value = match.searchParams.get(field)
    if (value) query.set(field, value)
  }
  const guideHref = '/compete/teams' + (query.size ? '?' + query.toString() : '') + '#captain-setup'
  return <section className={styles.guide} aria-label="Captain setup guide">
    <div className={styles.stepBody} style={{ paddingTop: 16 }}>
      <strong>Set up your team</strong>
      <p>Follow the guided steps to add your team, connect players, build a lineup, and share it.</p>
      <div className={styles.actions}>
        <Link className={styles.action} href={guideHref}>Open setup guide</Link>
        <Link href={matchWeekHref}>Open match week</Link>
      </div>
    </div>
  </section>
}
