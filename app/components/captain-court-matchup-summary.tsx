import { buildCourtMatchupSummary } from '@/lib/captain-court-matchup-summary'
import type { OpponentSeasonScout } from '@/lib/captain-opponent-season-scout'
import type { SetScoreMode } from '@/lib/player-set-score-grid'
import { formatDate } from '@/lib/captain-formatters'
import styles from './captain-opponent-season-scout.module.css'

export default function CaptainCourtMatchupSummary({ scout, index, mode, names }: {
  scout: OpponentSeasonScout; index: number; mode: SetScoreMode; names: string[]
}) {
  const matchup = buildCourtMatchupSummary(scout, index, mode)
  return <span className={styles.matchupSummary}>
    <span><span className={styles.note}>Your court</span><strong>{names.join(' / ') || 'Choose your players'}</strong></span>
    <span><span className={styles.note}>Latest recorded opponent{matchup ? ` · ${formatDate(matchup.date)}` : ''}</span><strong>{matchup?.names.join(' / ') || 'Players unavailable for the latest lineup'}</strong></span>
    {matchup ? <span className={styles.matchupStats}>
      <span>Recent scored matches: {matchup.recentSample ? `${matchup.recentWins} W · ${matchup.recentLosses} L (${matchup.recentSample})` : 'None recorded'}</span>
      <span>Season 7–5 / 7–6 sets: {matchup.close.wins + matchup.close.losses ? `${matchup.close.wins} W · ${matchup.close.losses} L` : 'None recorded'} · {matchup.seasonMatches} scored {mode === 'doubles' ? 'pair' : 'singles'} matches</span>
    </span> : null}
    <span className={styles.note}>Open to review this court or compare recent opponents.</span>
  </span>
}
