'use client'

import type { CaptainLineupNextAction } from '@/lib/captain-lineup-next-action'
import styles from './captain-lineup-mobile-action.module.css'

export default function CaptainLineupMobileAction({ action, disabled, busyLabel, error, onAction }: {
  action: CaptainLineupNextAction
  disabled: boolean
  busyLabel?: string
  error?: string
  onAction: () => void
}) {
  return (
    <section className={styles.bar} aria-label="Next lineup action">
      <div className={styles.content}>
        <p className={styles.detail} data-error={Boolean(error)} role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'}>{error || action.detail}</p>
        <button type="button" className={styles.button} disabled={disabled} aria-busy={Boolean(busyLabel)} onClick={onAction}>
          {busyLabel || action.label}
        </button>
      </div>
    </section>
  )
}
