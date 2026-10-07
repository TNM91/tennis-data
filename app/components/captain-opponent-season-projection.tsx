import { formatDate } from '@/lib/captain-formatters'
import type { OpponentSeasonCandidate, OpponentSeasonProjection } from '@/lib/captain-opponent-season-projection'
import styles from './captain-opponent-season-scout.module.css'

function CandidateEvidence({ candidate, fixtureCount }: { candidate: OpponentSeasonCandidate; fixtureCount: number }) {
  return <div className={styles.evidence}>
    <p className={styles.note}>Played this court in {candidate.appearances} of {fixtureCount} recent matches · {candidate.wins} W / {candidate.losses} L{candidate.unknown ? ` · ${candidate.unknown} unknown` : ''}</p>
    <p className={styles.score}>Last played {formatDate(candidate.latestDate)} · vs {candidate.latestOpponent}</p>
    <p className={styles.score}>Latest: {candidate.latestCourt.result || 'Result unknown'}{candidate.latestCourt.score ? ` · ${candidate.latestCourt.scoreOriented ? '' : 'Recorded score: '}${candidate.latestCourt.score}` : ' · Score not recorded'}</p>
  </div>
}

export default function CaptainOpponentSeasonProjection({ projection, onUseDraft }: {
  projection: OpponentSeasonProjection; onUseDraft: () => void
}) {
  return <details className={styles.lineRecords} aria-label="Recent-season opponent projection">
    <summary>Likely lineup from recent matches <span>{projection.courts.filter((court) => court.selected).length} courts supported · last {projection.fixtureCount} recorded matches</span></summary>
    <p className={styles.note}>Most frequent court combinations, with recent appearances breaking ties. This is a draft, not a confirmed lineup.</p>
    <button type="button" className={styles.action} onClick={onUseDraft} disabled={!projection.filled}>Use recent-season draft</button>
    <p className={styles.note}>{projection.filled ? `Adds ${projection.filled} players to open spots. Your choices stay in place. Review availability and adjust the opponent courts.` : 'No eligible open spots to fill. Edit your opponent courts to change the draft.'}</p>
    <ul className={styles.courts}>{projection.courts.map((court) => <li key={court.slotIndex}>
      <details className={styles.projectionCourt}>
        <summary aria-label={`${court.label} recent lineup evidence`}>
          <span className={styles.courtHeading}><strong>{court.label}</strong><span className={styles.note}>{court.preserved ? 'Your choice' : court.selected ? 'Suggested' : 'Open'}</span></span>
          <span className={styles.names}>{projection.slots[court.slotIndex].players.map((player) => player.playerName || 'Open spot').join(' / ')}</span>
          <span className={styles.note}>{court.selected ? `${court.selected.appearances} of ${projection.fixtureCount} recent matches` : 'History limited'} · Details ⌄</span>
        </summary>
      {court.selected ? <CandidateEvidence candidate={court.selected} fixtureCount={projection.fixtureCount} /> : <p className={styles.note}>{court.preserved ? 'Your selection stays in place. No compatible recent court was found.' : 'No eligible recorded player or pair fits this court without repeating a player.'}</p>}
      {court.candidates.length ? <details className={styles.alternatives}>
        <summary>Recorded court combinations · {court.candidates.length}</summary>
        {court.candidates.map((candidate) => <div key={candidate.key} className={styles.alternative}><strong className={styles.names}>{candidate.playerNames.join(' / ')}</strong><CandidateEvidence candidate={candidate} fixtureCount={projection.fixtureCount} /></div>)}
      </details> : null}
      </details>
    </li>)}</ul>
    <p className={styles.note}>Same season, league and flight, before your match date. Defaults, incomplete player links, conflicting courts and courts without a result or set score are excluded. Doubles suggestions use pairs who actually played together.</p>
  </details>
}
