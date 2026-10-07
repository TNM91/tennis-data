'use client'

import { useId, useMemo, useState } from 'react'
import { buildOpponentCourtScorePatterns } from '@/lib/captain-opponent-court-score-patterns'
import type { OpponentSeasonScout } from '@/lib/captain-opponent-season-scout'
import type { SetScoreMode } from '@/lib/player-set-score-grid'
import PlayerSetScoreGrid from './player-set-score-grid'
import styles from './captain-opponent-season-scout.module.css'

export default function CaptainOpponentCourtScorePatterns({ scout, slotIndex, mode, courtLabel }: {
  scout: OpponentSeasonScout; slotIndex: number; mode: SetScoreMode; courtLabel: string
}) {
  const patterns = useMemo(() => buildOpponentCourtScorePatterns(scout, slotIndex, mode), [scout, slotIndex, mode])
  const [selectedId, setSelectedId] = useState('')
  const selected = patterns.find((pattern) => pattern.id === selectedId) || patterns[0]
  const selectId = useId()
  return <details className={styles.scorePatterns} aria-label={`${courtLabel} opponent score patterns`}>
    <summary>Opponent score patterns <span>{mode === 'singles' ? 'Singles' : 'Pairs & all partners'} · selected season</span></summary>
    <p className={styles.note}>Players recorded on this court in the last four weeks. Scores include their other lines in the selected season, before your match.</p>
    {selected ? <>
      <label className={styles.playerLabel} htmlFor={selectId}>View score patterns for</label>
      <select className={styles.playerSelect} id={selectId} value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
        {patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}{pattern.scope === 'pair' ? ' · together' : pattern.scope === 'all-partners' ? ' · all partners' : ''}</option>)}
      </select>
      <PlayerSetScoreGrid key={selected.id} playerName={selected.name} matches={selected.matches} fixedMode={mode} doublesScope={selected.scope === 'pair' ? 'pair' : 'all-partners'} scopeLabel="Opponent season · before your match" />
    </> : <p className={styles.note}>No complete, linked {mode === 'singles' ? 'singles players' : 'doubles pairs'} are recorded on this court in the recent weeks.</p>}
    <p className={styles.note}>Set patterns describe past results; they do not change your win estimate.</p>
  </details>
}
