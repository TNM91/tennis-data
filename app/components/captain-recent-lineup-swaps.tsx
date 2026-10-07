import { formatDate } from '@/lib/captain-formatters'
import type { RecentLineupSwap } from '@/lib/captain-recent-lineup-swaps'
import styles from './captain-opponent-season-scout.module.css'

const percent = (value: number) => `${Math.round(value * 100)}%`

export default function CaptainRecentLineupSwaps({ suggestions, onApply, disabled = false }: {
  suggestions: RecentLineupSwap[]; onApply: (suggestion: RecentLineupSwap) => void; disabled?: boolean
}) {
  return <details className={styles.lineRecords}>
    <summary>Swaps supported by recent lineups <span>{suggestions.length ? `${suggestions.length} eligible swap${suggestions.length === 1 ? '' : 's'} to review` : 'No supported swaps yet'}</span></summary>
    <p className={styles.note}>Keeps doubles pairs together and respects player and court locks. Uses your current draft and today’s ratings.</p>
    {!suggestions.length ? <p className={styles.note}>No unlocked, eligible court swap improves the combined forecast in at least two recorded weeks without worsening another assessed week. Complete your courts and review locks to compare more options.</p> : suggestions.map((suggestion) => <details key={suggestion.id} className={styles.evidenceCourt}>
      <summary><strong>{suggestion.labels.join(' ↔ ')}</strong><span>Two-court forecast improves {suggestion.improvedWeeks}/{suggestion.weeks.length} assessed weeks · none worse</span></summary>
      <p className={styles.note}>{suggestion.names[0].join(' / ')} → {suggestion.labels[1]}<br />{suggestion.names[1].join(' / ')} → {suggestion.labels[0]}</p>
      <p className={styles.note}>Expected court wins across these two courts: {suggestion.beforeMean.toFixed(2)} → {suggestion.afterMean.toFixed(2)} out of 2, averaged over the same recorded weeks.</p>
      <ul className={styles.courts}>{suggestion.courts.map((court) => <li key={court.label}>
        <div className={styles.courtHeading}><strong>{court.label}</strong><span>{percent(court.before)} → {percent(court.after)}</span></div>
        <p className={styles.note}>Average court win estimate</p>
      </li>)}</ul>
      <details className={styles.lineRecords}><summary>Check each week</summary>
        <ul className={styles.courts}>{suggestion.weeks.map((week) => <li key={week.key}>
          <strong>{formatDate(week.date)}</strong>
          {suggestion.labels.map((label, index) => <p className={styles.note} key={label}>{label}: {percent(week.before[index])} → {percent(week.after[index])}</p>)}
        </li>)}</ul>
      </details>
      <button type="button" className={styles.action} disabled={disabled} onClick={() => onApply(suggestion)}>Apply {suggestion.labels.join(' / ')} swap</button>
      <p className={styles.note}>Updates your draft. Review it before saving or sending.</p>
    </details>)}
  </details>
}
