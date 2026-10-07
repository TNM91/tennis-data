import { formatDate } from '@/lib/captain-formatters'
import type { RecentLineupComparison } from '@/lib/captain-recent-lineup-comparison'
import styles from './captain-opponent-season-scout.module.css'
import CaptainRecentLineupSwaps from './captain-recent-lineup-swaps'
import type { RecentLineupSwap } from '@/lib/captain-recent-lineup-swaps'
import type { OpponentSeasonScout } from '@/lib/captain-opponent-season-scout'
import CaptainOpponentCourtScorePatterns from './captain-opponent-court-score-patterns'

const percent = (value: number) => `${Math.round(value * 100)}%`

export default function CaptainRecentLineupComparison({ comparison, scout, onReviewCourt, swaps, onApplySwap, swapsDisabled }: {
  comparison: RecentLineupComparison; onReviewCourt: (index: number) => void
  scout?: OpponentSeasonScout
  swaps?: RecentLineupSwap[]; onApplySwap?: (suggestion: RecentLineupSwap) => void; swapsDisabled?: boolean
}) {
  return <details className={styles.lineRecords}>
    <summary>Test your draft against recent lineups <span>Last {comparison.fixtureCount} recorded weeks</span></summary>
    <p className={styles.note}>Today’s rating forecast against the players recorded each week. Review availability before choosing your lineup.</p>
    {swaps && onApplySwap ? <CaptainRecentLineupSwaps suggestions={swaps} onApply={onApplySwap} disabled={swapsDisabled} /> : null}
    {comparison.courts.map((court) => <details key={court.id} className={styles.evidenceCourt}>
      <summary><strong>{court.label}</strong><span>{court.status}</span>
        <span>{court.minimum === null ? 'No forecast' : `${court.minimum === court.maximum ? percent(court.minimum) : `${percent(court.minimum)}–${percent(court.maximum!)}`} win estimate`} · {court.assessed}/{comparison.fixtureCount} weeks assessed</span>
      </summary>
      <p className={styles.note}>{court.names.join(' / ') || 'Choose your players'}</p>
      <ul className={styles.courts}>{court.weeks.map((week) => <li key={week.key}>
        <div className={styles.courtHeading}><strong>{formatDate(week.date)}</strong><span>{week.probability === null ? 'Not assessed' : `${percent(week.probability)} your court`}</span></div>
        <p className={styles.names}>{week.names.join(' / ') || 'Players not recorded'}</p>
        <p className={styles.note}>Their match vs {week.opponent}{week.result ? ` · ${week.result}` : ''}{week.score ? ` · Recorded score: ${week.score}` : ''}</p>
      </li>)}</ul>
      {scout ? <CaptainOpponentCourtScorePatterns scout={scout} slotIndex={court.index} mode={court.slotType} courtLabel={court.label} /> : null}
      <button className={styles.action} type="button" onClick={() => onReviewCourt(court.index)}>Review {court.label}</button>
    </details>)}
    <p className={styles.note}>Missing ratings, incomplete courts, defaults, and conflicting records are not assessed. A forecast is an estimate, not a match result.</p>
  </details>
}
