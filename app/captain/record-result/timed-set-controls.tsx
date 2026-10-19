'use client'

import { formatTimedScore, timedScoreSets, validateTimedScore, type TimedScoreInput, type TimedSetResult } from '@/lib/timed-score'
import styles from './record-result.module.css'

export default function TimedSetControls({ court, onChange }: {
  court: TimedScoreInput
  onChange: (timedSets: TimedSetResult[] | undefined) => void
}) {
  const error = validateTimedScore(court)
  return (
    <div className={styles.timedSets}>
      <label className={styles.compactLabel}>
        <span>Scoring option</span>
        <select value={court.timedSets ? 'timed' : 'standard'} onChange={(event) => onChange(event.target.value === 'timed' ? [] : undefined)}>
          <option value="standard">Standard match</option>
          <option value="timed">Timed match</option>
        </select>
      </label>
      {court.timedSets ? <>
        <p>With 15 minutes left, a lead of two or more games wins the set. Otherwise, play a set tiebreak. Enter games and optional tiebreak points from your team’s perspective, then choose the set winner.</p>
        {timedScoreSets(court.score).slice(0, 3).map((score, index) => {
          const result = court.timedSets?.find((set) => set.setNumber === index + 1)
          function update(patch: Partial<TimedSetResult> | null) {
            const remaining = (court.timedSets || []).filter((set) => set.setNumber !== index + 1)
            onChange(patch ? [...remaining, { setNumber: index + 1, decidedBy: 'tiebreak', winner: 'opponent', ...result, ...patch }] : remaining)
          }
          return (
            <fieldset key={index} className={styles.timedSet}>
              <legend>Set {index + 1}: {score}</legend>
              <label className={styles.compactLabel}>
                <span>Set finish</span>
                <select value={result?.decidedBy || 'standard'} onChange={(event) => {
                  if (event.target.value === 'standard') update(null)
                  else {
                    const [a, b] = score.split(/[-–]/).map(Number)
                    update({ decidedBy: event.target.value as TimedSetResult['decidedBy'], winner: event.target.value === 'tiebreak' ? '' : a > b ? 'team' : 'opponent', tiebreakScore: '' })
                  }
                }}>
                  <option value="standard">Completed normally</option>
                  <option value="two_game_lead">Timed: two-game lead</option>
                  <option value="tiebreak">Timed: set tiebreak</option>
                </select>
              </label>
              {result ? <label className={styles.compactLabel}>
                <span>Set winner</span>
                <select value={result.winner} onChange={(event) => update({ winner: event.target.value as TimedSetResult['winner'] })}>
                  <option value="">Choose set winner</option>
                  <option value="team">Our team</option>
                  <option value="opponent">Opponents</option>
                </select>
              </label> : null}
              {result?.decidedBy === 'tiebreak' ? <label className={styles.compactLabel}>
                <span>Tiebreak points (optional)</span>
                <input value={result.tiebreakScore || ''} placeholder="5-7" onChange={(event) => update({ tiebreakScore: event.target.value })} />
              </label> : null}
            </fieldset>
          )
        })}
        <p role="status">{error || formatTimedScore(court)}</p>
      </> : null}
    </div>
  )
}
