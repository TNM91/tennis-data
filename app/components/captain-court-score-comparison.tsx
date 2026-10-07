import { courtScoreRecord } from '@/lib/captain-court-score-comparison'
import type { CaptainPlayerLineupIntelligence } from '@/lib/captain-lineup-intelligence'
import type { SetScoreMode } from '@/lib/player-set-score-grid'
import styles from './captain-court-score-comparison.module.css'

type Side = { ids: string[]; names: string[] }
export default function CaptainCourtScoreComparison({ mode, team, opponent, histories }: {
  mode: SetScoreMode; team: Side; opponent: Side; histories: Record<string, CaptainPlayerLineupIntelligence>
}) {
  return <details className={styles.panel}>
    <summary>Compare this court <span>Set records · your lineup vs projected opponent</span></summary>
    <div className={styles.sides}>{([{ label: 'Your court', side: team }, { label: 'Projected opponent', side: opponent }]).map(({ label, side }) => {
      const record = courtScoreRecord(side.ids, histories, mode)
      return <section key={label} className={styles.side} aria-label={label}>
        <h4>{label}</h4><strong>{side.names.filter(Boolean).join(' / ') || 'Players needed'}</strong>
        <p>{!record.complete ? 'Complete this court to compare.' : record.scoredMatches ? `${record.scoredMatches} scored matches · ${record.totalSets} sets` : 'No scored matches yet.'}</p>
        <dl><div><dt>All sets</dt><dd>{record.totalSets ? `${record.setWins} W · ${record.setLosses} L` : '—'}</dd></div>
          <div><dt>Close · 7–5 / 7–6</dt><dd>{record.close.wins + record.close.losses ? `${record.close.wins} W · ${record.close.losses} L` : '—'}</dd></div>
          <div><dt>Decisive · 6–0 to 6–2</dt><dd>{record.decisive.wins + record.decisive.losses ? `${record.decisive.wins} W · ${record.decisive.losses} L` : '—'}</dd></div></dl>
      </section>
    })}</div>
    <p className={styles.note}>Recorded court history. {mode === 'doubles' ? 'Only matches played together by each pair. ' : ''}Complete scored matches only; match tiebreaks excluded. These set records do not change the rating forecast.</p>
  </details>
}
