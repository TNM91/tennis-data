'use client'

import type { MouseEvent } from 'react'
import styles from './captain-message-send-focus.module.css'

type Props = {
  recipients: string[]
  body: string
  title: string
  match: string
  smsHref: string
  allowed: boolean
  loading: boolean
  error?: string | null
  onOpenTexts: (event: MouseEvent<HTMLAnchorElement>) => void
}

export default function CaptainMessageSendFocus({ recipients, body, title, match, smsHref, allowed, loading, error, onOpenTexts }: Props) {
  const ready = allowed && !loading && recipients.length > 0 && body.trim().length > 0
  return (
    <section className={styles.panel} aria-label="Review team text">
      <h2>{title || 'Send the plan'}</h2>
      {match ? <p className={styles.detail}>{match}</p> : null}
      <strong>{recipients.length} recipient{recipients.length === 1 ? '' : 's'}</strong>
      {recipients.length ? (
        <details className={styles.audience}>
          <summary>{recipients.slice(0, 3).join(', ')}{recipients.length > 3 ? ` +${recipients.length - 3} more` : ''}</summary>
          <ul>{recipients.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul>
        </details>
      ) : <p className={styles.detail}>Choose players with a phone number and text consent in Message tools.</p>}
      <p className={styles.body}>{body.trim() || 'Choose a message in Message tools to start your draft.'}</p>
      {ready ? <a className={styles.primary} href={smsHref} onClick={onOpenTexts}>Open texts</a> : <button className={styles.primary} disabled>Open texts</button>}
      <p className={styles.detail}>{loading ? 'Loading your team text…' : !allowed ? 'Captain access is required to text your team.' : 'Review and send in your texting app. Opening it does not confirm delivery.'}</p>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </section>
  )
}
