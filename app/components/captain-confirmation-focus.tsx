'use client'

import type { CaptainConfirmationFocus, ConfirmationPlayer } from '@/lib/captain-confirmation-focus'
import styles from './captain-confirmation-focus.module.css'

function PlayerRow({ player, onReview }: { player: ConfirmationPlayer; onReview: () => void }) {
  const label = player.status === 'in' ? 'In' : player.status === 'out' ? 'Out' : player.status === 'maybe' ? 'Maybe' : 'No reply'
  return <li className={styles.row}>
    <div><strong>{player.name}</strong>{player.missingRoster ? <small>Not on the loaded roster</small> : player.note ? <small>{player.note}</small> : null}</div>
    <span className={styles.status} data-status={player.status}>{label}</span>
    {player.missingRoster || player.status === 'out' || player.status === 'maybe' ? <button type="button" className={styles.review} onClick={onReview}>Review in lineup</button> : null}
  </li>
}

export default function CaptainConfirmationFocusPanel({ focus, loading, disabled, busyLabel, feedback, error, onAction, onReview, onRetry }: {
  focus: CaptainConfirmationFocus
  loading: boolean
  disabled: boolean
  busyLabel?: string
  feedback?: string
  error?: string
  onAction: () => void
  onReview: () => void
  onRetry?: () => void
}) {
  return <section className={styles.panel} aria-label="Lineup player confirmations">
    <div className={styles.header}>
      <h2>{focus.selected.length ? 'Your lineup players' : 'Team availability'}</h2>
      <span>{focus.selected.length ? `${focus.confirmed.length}/${focus.selected.length} in` : `${focus.answered}/${focus.total} answered`}</span>
    </div>
    {loading ? <p role="status">Loading players…</p> : <>
      <p className={styles.detail}>{focus.actionDetail}</p>
      <button type="button" className={styles.primary} disabled={disabled} aria-busy={Boolean(busyLabel)} onClick={onAction}>{busyLabel || focus.actionLabel}</button>
      {error ? <p className={styles.error} role="alert">{error}</p> : feedback ? <p className={styles.detail} role="status">{feedback}</p> : null}
      {error && onRetry ? <button type="button" className={styles.review} onClick={onRetry}>Try again</button> : null}
      {focus.attention.length ? <ul className={styles.list} aria-label="Selected players needing attention">{focus.attention.map((player) => <PlayerRow key={player.id} player={player} onReview={onReview}/>)}</ul>
        : focus.selected.length ? <p className={styles.detail}>Every selected player is in.</p> : <p className={styles.detail}>Choose your lineup to focus on its players. Team replies are below.</p>}
      {focus.confirmed.length ? <details className={styles.disclosure}>
        <summary>Confirmed ({focus.confirmed.length})</summary>
        <ul className={styles.list}>{focus.confirmed.map((player) => <PlayerRow key={player.id} player={player} onReview={onReview}/>)}</ul>
      </details> : null}
      {focus.others.length ? <details className={styles.disclosure}>
        <summary>{focus.selected.length ? 'Rest of team' : 'Team roster'} ({focus.others.length})</summary>
        <ul className={styles.list}>{focus.others.map((player) => <PlayerRow key={player.id} player={player} onReview={onReview}/>)}</ul>
      </details> : null}
    </>}
  </section>
}
