import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { getAvailabilityEntry } from '@/lib/availability-onboarding'
import styles from './availability-entry.module.css'

export default function AvailabilityEntryCard({ href, signedIn, loading = false, children }: { href: string; signedIn: boolean; loading?: boolean; children?: ReactNode }) {
  const entry = getAvailabilityEntry(href)
  if (!entry) return <main className={styles.page}><section className={styles.card}><h1>Ask for the full team link.</h1><p>This availability link is incomplete. Ask your captain to resend the group message, then open its link.</p></section></main>
  const next = encodeURIComponent(entry?.href || '/compete/teams')
  return <main className={styles.page}>
    <Link href="/" className={styles.brand} aria-label="TenAceIQ home"><Image src="/brand/masters/tenaceiq-full-dark-ui.svg" width={220} height={70} alt="TenAceIQ" priority /></Link>
    <section className={styles.card} data-signed-in={signedIn}>
      <p className={styles.eyebrow}>{entry?.match ? 'Match-week availability' : 'Season availability'}</p>
      <h1>{signedIn ? 'Let’s connect your team.' : 'Your team. Your availability.'}</h1>
      {entry ? <div className={styles.team}><strong>{entry.team}</strong><span>{entry.league}{entry.flight ? ` · ${entry.flight}` : ''}</span></div> : null}
      {!signedIn ? <p>{entry.match ? 'Let your captain know when you can play. Start with this match, add other dates when you know, and keep them in your calendar.' : 'Let your captain know when you can play this season. Mark the dates you know now, update later, and keep matches in your calendar.'}</p> : null}
      <ol className={styles.steps} aria-label="Availability setup">
        <li data-complete={signedIn}><span>{signedIn ? '✓' : '1'}</span>Free account</li>
        <li aria-current={signedIn ? 'step' : undefined}><span>2</span>Connect your player</li>
        <li><span>3</span>Mark availability</li>
      </ol>
      {loading ? <p role="status">Opening your availability…</p> : !signedIn ? <div className={styles.actions}>
        <Link href={`/join?plan=free&next=${next}`} className={styles.primary}>Create free account</Link>
        <Link href={`/login?next=${next}`} className={styles.secondary}>Already a member? Sign in</Link>
        <p className={styles.note}>No payment card. No paid plan. Connect once; future requests open your own answers.</p>
      </div> : children}
      <details className={styles.help}><summary>{signedIn ? 'Wrong team or can’t find your name?' : 'Why do I need to connect?'}</summary><p>This link went to the whole team. Connecting keeps your answers attached to you. Only choose your own player record. Don’t create a duplicate player just to reply. If your name is missing, ask your captain to check the roster or send your personal link; you can reply through that link without an account.</p>{signedIn ? <Link href="/team-connections" className={styles.secondary}>Review my team connections</Link> : null}</details>
    </section>
    <p className={styles.footnote}>Yes, No, or Not sure · Update anytime · Apple, Google &amp; TiQ calendars<br />Availability helps your captain plan; it is not a final lineup selection.</p>
  </main>
}
