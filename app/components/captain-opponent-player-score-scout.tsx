'use client'

import { useId, useMemo, useState } from 'react'
import { buildOpponentSetScorePlayers, type OpponentSeasonScout } from '@/lib/captain-opponent-season-scout'
import PlayerSetScoreGrid from './player-set-score-grid'
import styles from './captain-opponent-season-scout.module.css'

export default function CaptainOpponentPlayerScoreScout({ scout }: { scout: OpponentSeasonScout }) {
  const players = useMemo(() => buildOpponentSetScorePlayers(scout), [scout])
  const [playerId, setPlayerId] = useState('')
  const selected = players.find((player) => player.id === playerId) || players[0]
  const selectId = useId()
  return <details className={styles.lineRecords}>
    <summary>Player set-score grids <span>Close sets, clear wins & losses</span></summary>
    {selected ? <>
      <label className={styles.playerLabel} htmlFor={selectId}>Scout a player</label>
      <select className={styles.playerSelect} id={selectId} value={selected.id} onChange={(event) => setPlayerId(event.target.value)}>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
      <PlayerSetScoreGrid key={selected.id} playerName={selected.name} matches={selected.matches} scopeLabel="Selected opponent season · before your match" />
    </> : <p className={styles.note}>Player score grids appear when their names are linked to recorded singles or doubles courts.</p>}
  </details>
}
