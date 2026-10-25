'use client'

import type { CaptainHomeFocusAction, CaptainHomeMatchFocus } from '@/lib/captain-home-match-focus'
import styles from './captain-home-match-focus.module.css'

export default function CaptainHomeMatchFocusCard({ focus, disabled, onAction, native=false, metricLabels }: {
  native?: boolean
  metricLabels?: {courts:string;confirmed:string;waiting:string}
  focus: CaptainHomeMatchFocus
  disabled: boolean
  onAction: (kind: CaptainHomeFocusAction) => void
}) {
  return (
    <section className={styles.card} aria-label="Next match readiness">
      <dl className={styles.metrics}>
        <div><dt>{metricLabels?.courts??'Courts'}</dt><dd>{focus.courtsLabel}</dd></div>
        <div><dt>{metricLabels?.confirmed??'Confirmed'}</dt><dd>{focus.confirmedLabel}</dd></div>
        <div><dt>{metricLabels?.waiting??'Waiting'}</dt><dd>{focus.waitingLabel}</dd></div>
      </dl>
      {focus.issues.length ? <ul className={styles.issues} aria-label="Match needs attention">
        {focus.issues.map((issue,index) => <li key={issue.kind}><button type="button" data-focus-issue={native?index:undefined} disabled={disabled} onClick={() => onAction(issue.kind)}>{issue.label}</button></li>)}
      </ul> : null}
      <p className={styles.detail}>{focus.action.detail}</p>
      <button type="button" data-focus-primary={native?'':undefined} className={styles.primary} disabled={disabled} onClick={() => onAction(focus.action.kind)}>{focus.action.label}</button>
    </section>
  )
}
