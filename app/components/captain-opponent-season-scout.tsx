'use client'

import { formatDate } from '@/lib/captain-formatters'
import type { OpponentScoutFixture, OpponentSeasonScout } from '@/lib/captain-opponent-season-scout'
import styles from './captain-opponent-season-scout.module.css'
import CaptainOpponentPlayerScoreScout from './captain-opponent-player-score-scout'
import CaptainOpponentSeasonProjection from './captain-opponent-season-projection'
import type { OpponentSeasonProjection } from '@/lib/captain-opponent-season-projection'
import CaptainRecentLineupComparison from './captain-recent-lineup-comparison'
import type { RecentLineupComparison } from '@/lib/captain-recent-lineup-comparison'
import type { RecentLineupSwap } from '@/lib/captain-recent-lineup-swaps'

export default function CaptainOpponentSeasonScout({ scout, opponent, loading = false, onUseLineup, onReviewCourt, projection, onUseSeasonDraft, comparison, swaps, onApplySwap, swapsDisabled }: {
  scout: OpponentSeasonScout; opponent: string; loading?: boolean
  onUseLineup: (fixture: OpponentScoutFixture) => void; onReviewCourt: (slotIndex: number) => void
  projection?: OpponentSeasonProjection; onUseSeasonDraft?: () => void
  comparison?: RecentLineupComparison
  swaps?: RecentLineupSwap[]; onApplySwap?: (suggestion: RecentLineupSwap) => void; swapsDisabled?: boolean
}) {
  const latest = scout.fixtures[0]
  function fixtureBody(fixture: OpponentScoutFixture) {
    return <div className={styles.fixtureBody}>
      <p className={styles.note}>{fixture.wins} court wins · {fixture.losses} losses{fixture.unknown ? ` · ${fixture.unknown} results unknown` : ''}
        {fixture.courts.length !== fixture.expectedCourts ? ` · ${fixture.courts.length} courts recorded` : ''}</p>
      <ul className={styles.courts}>
        {fixture.courts.map((court) => <li key={court.key}>
          <div className={styles.courtHeading}><strong>{court.label}</strong><span className={styles.result} data-result={court.result || 'unknown'}>{court.needsReview ? 'Review' : court.result || 'Pending'}</span></div>
          <p className={styles.names}>{court.playerNames.length ? court.playerNames.join(' / ') : 'Players not recorded'}</p>
          <p className={styles.score}>{court.needsReview ? 'Conflicting records — check this court.' : court.score ? `${court.scoreOriented ? '' : 'Recorded score: '}${court.score}` : 'Score not recorded'}
            {court.gamesFor !== null ? <span>Games {court.gamesFor}–{court.gamesAgainst}</span> : null}</p>
        </li>)}
      </ul>
      <button type="button" className={styles.action} onClick={() => onUseLineup(fixture)} disabled={!fixture.courts.some((court) => court.slotIndex !== null && court.playerIds.length && !court.needsReview)}>Use this week as opponent draft</button>
      <p className={styles.note}>Fills eligible players into open spots. Review who may play this week.</p>
    </div>
  }
  return <details className={styles.scout} id="captain-opponent-season-scout">
    <summary className={styles.heading}>
      <span><span className={styles.kicker}>Opponent scouting</span><strong>{opponent || 'Choose an opponent'}</strong>
        <span className={styles.note}>{loading ? 'Loading season results…' : latest ? `${scout.fixtures.length} recorded week${scout.fixtures.length === 1 ? '' : 's'} · latest ${formatDate(latest.date)}` : 'Recent lineups, line records & scores'}</span></span>
      <span className={styles.openLabel}>Scout <span aria-hidden="true">⌄</span></span>
    </summary>
    <div className={styles.body}>
      {loading ? <p className={styles.note} role="status">Loading season results…</p> : !scout.ready ? <p className={styles.note}>Choose your league, flight, opponent, and match date to scout their season.</p> : !latest ? <p className={styles.note}>No earlier court results are recorded for this opponent in the selected season, league, and flight. Add their match results to see recent lineups and scores.</p> : <>
        {projection && onUseSeasonDraft ? <CaptainOpponentSeasonProjection projection={projection} onUseDraft={onUseSeasonDraft} /> : null}
        {comparison ? <CaptainRecentLineupComparison comparison={comparison} scout={scout} onReviewCourt={onReviewCourt} swaps={swaps} onApplySwap={onApplySwap} swapsDisabled={swapsDisabled} /> : null}
        <details className={styles.lineRecords} aria-label="Opponent season line records">
          <summary>Which lines are winning? <span>Season W–L & games</span></summary>
          <p className={styles.note}>Recorded season matches before your match date. W–L includes defaults when recorded.</p>
          <div className={styles.form}>
            {scout.lines.map((line) => <div className={styles.formRow} key={line.key}>
              <div>{line.slotIndex !== null ? <button type="button" className={styles.review} onClick={() => onReviewCourt(line.slotIndex!)} aria-label={`Review my ${line.label} matchup`}><strong>{line.label} →</strong></button> : <strong>{line.label}</strong>}<span className={styles.note}>{line.appearances} recorded · {line.defaults ? `${line.defaults} default${line.defaults === 1 ? '' : 's'} · ` : ''}{line.scoredCourts} scored</span></div>
              <div className={styles.figures}><strong>{line.wins}–{line.losses} <span>W–L</span></strong><span>{line.scoredCourts ? `${line.gamesFor}–${line.gamesAgainst} games` : 'Games unavailable'}</span></div>
            </div>)}
          </div>
          <p className={styles.note}>Tap a line to review your matchup.</p>
        </details>
        <CaptainOpponentPlayerScoreScout scout={scout} />
        <details className={styles.week} aria-label="Latest opponent lineup">
          <summary><strong>Latest recorded lineup</strong><span>{formatDate(latest.date)} · vs {latest.opponent}</span></summary>
          {fixtureBody(latest)}
        </details>
        {scout.fixtures.length > 1 ? <section aria-label="Earlier opponent lineups"><h3>Earlier weeks</h3>{scout.fixtures.slice(1).map((fixture) => <details key={fixture.key} className={styles.week}><summary><strong>{formatDate(fixture.date)}</strong><span>vs {fixture.opponent}</span><span>{fixture.wins}–{fixture.losses} courts{fixture.unknown ? ' · incomplete' : ''}</span></summary>{fixtureBody(fixture)}</details>)}</section> : null}
        <p className={styles.note}>Completed scores and games read from {opponent}’s side. Game totals exclude match tiebreaks. Unresolved scores stay as recorded.</p>
      </>}
    </div>
  </details>
}
