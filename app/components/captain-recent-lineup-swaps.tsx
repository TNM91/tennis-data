import { formatDate } from '@/lib/captain-formatters'
import type { RecentLineupSwap } from '@/lib/captain-recent-lineup-swaps'
import styles from './captain-opponent-season-scout.module.css'

const percent = (value: number) => `${Math.round((value + Number.EPSILON) * 100)}%`

export default function CaptainRecentLineupSwaps({ suggestions, onApply, disabled = false }: {
  suggestions: RecentLineupSwap[]; onApply: (suggestion: RecentLineupSwap) => void; disabled?: boolean
}) {
  return <details className={styles.lineRecords}>
    <summary>Swaps supported by recent lineups <span>{suggestions.length ? `${suggestions.length} eligible swap${suggestions.length === 1 ? '' : 's'} to review` : 'No supported swaps yet'}</span></summary>
    <p className={styles.note}>Ranks by team-match win improvement when at least two complete weeks can be assessed. Keeps doubles pairs together and respects locks.</p>
    {!suggestions.length ? <p className={styles.note}>No unlocked, eligible court swap improves a supported forecast in at least two recorded weeks without worsening another assessed week. Complete your courts and review locks to compare more options.</p> : suggestions.map((suggestion) => <details key={suggestion.id} className={styles.evidenceCourt}>
      <summary><strong>{suggestion.labels.join(' ↔ ')}</strong><span>{suggestion.ranking === 'team-match' ? 'Team-match' : 'Two-court'} forecast improves {suggestion.improvedWeeks}/{suggestion.ranking === 'team-match' ? suggestion.teamWeeks : suggestion.weeks.length} assessed weeks · none worse</span></summary>
      <p className={styles.note}>{suggestion.names[0].join(' / ')} → {suggestion.labels[1]}<br />{suggestion.names[1].join(' / ')} → {suggestion.labels[0]}</p>
      {suggestion.ranking === 'team-match' ? <>
        <p className={styles.matchOdds}><strong>Team-match win estimate{suggestion.courtCount % 2 === 0 ? ' · outright win' : ''}</strong><span>{percent(suggestion.teamBeforeMean!)} → {percent(suggestion.teamAfterMean!)}</span></p>
        <p className={styles.note}>Win {suggestion.neededWins} of {suggestion.courtCount} courts · {suggestion.teamWeeks}/{suggestion.fixtureCount} recorded weeks fully assessed. Average across those same complete weeks.</p>
        {suggestion.courtCount % 2 === 0 ? <p className={styles.note}>Tied court counts are not assessed here; local tiebreaks can change the result.</p> : null}
      </> : <p className={styles.note}>Court-only ranking: fewer than two complete weeks, or a format without supported team scoring. Team-match odds are not used to rank this swap.</p>}
      <p className={styles.note}>Expected court wins across these two courts: {suggestion.beforeMean.toFixed(2)} → {suggestion.afterMean.toFixed(2)} out of 2, averaged over the same recorded weeks.</p>
      <ul className={styles.courts}>{suggestion.courts.map((court) => <li key={court.label}>
        <div className={styles.courtHeading}><strong>{court.label}</strong><span>{percent(court.before)} → {percent(court.after)}</span></div>
        <p className={styles.note}>Average court win estimate</p>
      </li>)}</ul>
      <details className={styles.lineRecords}><summary>Check each week</summary>
        <ul className={styles.courts}>{suggestion.weeks.map((week) => <li key={week.key}>
          <strong>{formatDate(week.date)}</strong>
          <p className={styles.note}>{week.teamBefore !== null && week.teamAfter !== null ? `Team-match: ${percent(week.teamBefore)} → ${percent(week.teamAfter)}` : 'Team-match not assessed: incomplete evidence or unsupported scoring.'}</p>
          {suggestion.labels.map((label, index) => <p className={styles.note} key={label}>{label}: {percent(week.before[index])} → {percent(week.after[index])}</p>)}
        </li>)}</ul>
      </details>
      <button type="button" className={styles.action} disabled={disabled} onClick={() => onApply(suggestion)}>Apply {suggestion.labels.join(' / ')} swap</button>
      <p className={styles.note}>Updates your draft. Review it before saving or sending.</p>
    </details>)}
    {suggestions.some((suggestion) => suggestion.ranking === 'team-match') ? <p className={styles.note}>Team estimates model court outcomes independently and require a court majority. Tied court counts are excluded; local tiebreaks and weighted points are not modeled. Uses today’s ratings and only defaults you marked for this match.</p> : null}
  </details>
}
