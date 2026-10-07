'use client'

import { useId, useMemo, useState } from 'react'
import { formatDate } from '@/lib/captain-formatters'
import { buildPlayerSetScoreGrid, type PlayerSetScoreMatch, type SetScoreLabel, type SetScoreMode } from '@/lib/player-set-score-grid'
import styles from './player-set-score-grid.module.css'

export default function PlayerSetScoreGrid({ matches, playerName, initialMode, scopeLabel = 'Recorded player history' }: {
  matches: PlayerSetScoreMatch[]; playerName: string; initialMode?: SetScoreMode; scopeLabel?: string
}) {
  const [mode, setMode] = useState<SetScoreMode>(initialMode || (matches.some((match) => match.matchType === 'singles') ? 'singles' : 'doubles'))
  const [selectedScore, setSelectedScore] = useState<SetScoreLabel | null>(null)
  const [visibleScorecards, setVisibleScorecards] = useState(5)
  const headingId = useId()
  const grid = useMemo(() => buildPlayerSetScoreGrid(matches, mode), [matches, mode])
  const selected = grid.buckets.find((bucket) => bucket.label === selectedScore)
  const peak = Math.max(1, ...grid.buckets.map((bucket) => bucket.wins + bucket.losses))
  return <section className={styles.panel} aria-labelledby={headingId}>
    <div className={styles.heading}><div><h4 id={headingId}>Set-score grid</h4><p>{playerName} · {scopeLabel}</p></div></div>
    <div className={styles.modes} role="group" aria-label={`${playerName} set-score discipline`}>
      {(['singles', 'doubles'] as const).map((value) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setSelectedScore(null); setVisibleScorecards(5) }}>{value === 'singles' ? 'Singles' : 'Doubles · all partners'}</button>)}
    </div>
    {grid.totalSets ? <>
      <p className={styles.sample}>{grid.totalSets} sets · {grid.setWins} won / {grid.setLosses} lost · {grid.scoredMatches} scored matches</p>
      <div className={styles.grid} aria-label={`${mode === 'singles' ? 'Singles' : 'Doubles'} set wins and losses by score`}>
        {grid.buckets.map((bucket) => {
          const count = bucket.wins + bucket.losses
          return <button type="button" key={bucket.label} className={styles.cell} aria-pressed={bucket.label === selectedScore} disabled={!count} onClick={() => { setSelectedScore((current) => current === bucket.label ? null : bucket.label); setVisibleScorecards(5) }} aria-label={`${bucket.label}: ${bucket.wins} sets won, ${bucket.losses} lost${count ? '. View scorecards' : '. No recorded sets'}`}>
            <strong>{bucket.label}</strong>
            <span className={styles.counts}><span className={styles.won}>{bucket.wins} W</span><span className={styles.lost}>{bucket.losses} L</span></span>
            <small>{bucket.winPercentage === null ? 'No sets' : `${bucket.winPercentage}% won`}</small>
            <span className={styles.heat} aria-hidden="true"><i style={{ width: `${count / peak * 100}%` }} /></span>
          </button>
        })}
      </div>
      <p className={styles.note}>Each square combines both sides of a set score: 6–4 wins and 4–6 losses. Tap a score for its matches. Longer bars mean more sets.</p>
      {selected ? <div className={styles.scorecards} aria-label={`${selected.label} set scorecards`}>
        <strong>{selected.label} sets · {selected.wins} won / {selected.losses} lost</strong>
        <p className={styles.note}>{Math.min(visibleScorecards, selected.matches.length)} of {selected.matches.length} matching scorecards</p>
        <ul>{selected.matches.slice(0, visibleScorecards).map(({ match, wins, losses }) => <li key={match.id}><strong>{match.date ? formatDate(match.date) : 'Date not recorded'}{match.opponent ? ` · vs ${match.opponent}` : ''}</strong>{match.partner ? <span>With {match.partner}</span> : null}<span>{wins} set{wins === 1 ? '' : 's'} won / {losses} lost at {selected.label} · Match {match.result === 'W' ? 'won' : 'lost'}</span><span>Recorded score: {match.score}</span></li>)}</ul>
        {selected.matches.length > visibleScorecards ? <button type="button" className={styles.more} onClick={() => setVisibleScorecards((count) => count + 5)}>Show {Math.min(5, selected.matches.length - visibleScorecards)} more matches</button> : null}
      </div> : null}
    </> : <p className={styles.note}>No complete, decided {mode} scores are recorded for this view yet.</p>}
    <p className={styles.note}>Set results include wins inside lost matches and losses inside won matches. Complete best-of-three scores only; match tiebreaks are excluded.{mode === 'doubles' ? ' Doubles combines every recorded partner.' : ''}{grid.excludedMatches ? ` ${grid.excludedMatches} match${grid.excludedMatches === 1 ? '' : 'es'} excluded for unusable scores, unknown results, or conflicting records.` : ''}</p>
  </section>
}
