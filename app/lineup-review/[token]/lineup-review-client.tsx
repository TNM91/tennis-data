'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildCaptainLineupReviewReturnText,
  countCaptainLineupReviewChanges,
  type CaptainLineupReviewPayload,
  type CaptainLineupReviewSlot,
} from '@/lib/captain-lineup-review'
import { buildSmsHref, formatDate } from '@/lib/captain-formatters'
import styles from './lineup-review.module.css'

type SubmitResult = {
  captainUrl: string
  changedCourts: number
}

export default function LineupReviewClient({ token }: { token: string }) {
  const [review, setReview] = useState<CaptainLineupReviewPayload | null>(null)
  const [slots, setSlots] = useState<CaptainLineupReviewSlot[]>([])
  const [reviewerName, setReviewerName] = useState('')
  const [reviewerNote, setReviewerNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/lineup-reviews/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { ok?: boolean; message?: string; review?: CaptainLineupReviewPayload }
        if (!response.ok || !body.review) throw new Error(body.message || 'This lineup review could not be opened.')
        if (!active) return
        setReview(body.review)
        setSlots(body.review.proposedSlots ?? body.review.slots)
        setReviewerName(body.review.reviewerName)
        setReviewerNote(body.review.reviewerNote)
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'This lineup review could not be opened.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token])

  const assignedKeys = useMemo(() => new Set(slots.flatMap((slot) => slot.players.map((player) => (
    player.playerId || player.playerName.toLowerCase()
  )).filter(Boolean))), [slots])
  const changedCourts = review ? countCaptainLineupReviewChanges(review.slots, slots) : 0
  const filledPlayers = slots.flatMap((slot) => slot.players).filter((player) => player.playerName).length
  const totalPlayers = slots.reduce((count, slot) => count + slot.players.length, 0)

  function choosePlayer(slotIndex: number, playerIndex: number, playerId: string) {
    if (!review) return
    const rosterPlayer = playerId.startsWith('name:')
      ? review.roster.find((player) => player.name === playerId.slice(5))
      : review.roster.find((player) => player.id === playerId)
    setSlots((current) => current.map((slot, currentSlotIndex) => ({
      ...slot,
      players: slot.players.map((player, currentPlayerIndex) => {
        if (currentSlotIndex === slotIndex && currentPlayerIndex === playerIndex) {
          return rosterPlayer
            ? { playerId: rosterPlayer.id, playerName: rosterPlayer.name }
            : { playerId: '', playerName: '' }
        }
        if (rosterPlayer && player.playerId === rosterPlayer.id) return { playerId: '', playerName: '' }
        return player
      }),
    })))
  }

  async function submitSuggestion() {
    if (!review || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/lineup-reviews/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedSlots: slots, reviewerName, reviewerNote }),
      })
      const body = await response.json() as { ok?: boolean; message?: string; captainUrl?: string; changedCourts?: number }
      if (!response.ok || !body.ok || !body.captainUrl) throw new Error(body.message || 'The suggestion could not be saved.')
      setSubmitted({ captainUrl: body.captainUrl, changedCourts: body.changedCourts ?? changedCourts })
      setReview((current) => current ? { ...current, status: 'submitted', proposedSlots: slots, reviewerName, reviewerNote } : current)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The suggestion could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className={styles.page}><div className={styles.loading}>Opening the private lineup…</div></main>
  if (!review) return <main className={styles.page}><div className={styles.error} role="alert">{error || 'This lineup review is unavailable.'}</div></main>

  const returnText = submitted ? buildCaptainLineupReviewReturnText({
    reviewerName,
    teamName: review.teamName,
    opponentTeam: review.opponentTeam,
    captainUrl: submitted.captainUrl,
    changedCourts: submitted.changedCourts,
  }) : ''

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.kicker}>Private lineup review</div>
        <div className={styles.heroTopline}>
          <div>
            <h1>{submitted ? 'Suggestion ready.' : 'Pressure-test this lineup.'}</h1>
            <p>{review.teamName}{review.opponentTeam ? ` vs ${review.opponentTeam}` : ''}</p>
          </div>
          <span className={styles.status}>{submitted ? 'Ready to return' : `${filledPlayers}/${totalPlayers} set`}</span>
        </div>
        <div className={styles.matchDetails}>
          {review.matchDate ? <span>{formatDate(review.matchDate)}</span> : null}
          {review.matchTime ? <span>{review.matchTime}</span> : null}
          {review.facility ? <span>{review.facility}</span> : null}
        </div>
        <p className={styles.assurance}>Your edits create a separate suggestion. The captain&apos;s lineup does not change unless they apply it.</p>
      </section>

      {submitted ? (
        <section className={styles.returnCard} aria-live="polite">
          <div className={styles.kicker}>Saved in TiQ</div>
          <h2>{submitted.changedCourts ? `${submitted.changedCourts} court${submitted.changedCourts === 1 ? '' : 's'} changed.` : 'No swaps suggested.'}</h2>
          <p>The final step is yours: text the proposal back so the captain can compare and apply it.</p>
          <a className={styles.primaryAction} href={buildSmsHref([], returnText)}>Text proposal back</a>
          <button className={styles.secondaryAction} type="button" onClick={() => setSubmitted(null)}>Make another edit</button>
        </section>
      ) : (
        <>
          <section className={styles.courts} aria-label="Lineup courts">
            <div className={styles.sectionHeading}>
              <div>
                <div className={styles.kicker}>Potential lineup</div>
                <h2>Move players if you see a better plan.</h2>
              </div>
              <span>{changedCourts ? `${changedCourts} changed` : 'Original'}</span>
            </div>
            {slots.map((slot, slotIndex) => (
              <article className={styles.court} key={slot.id}>
                <div className={styles.courtHeading}>
                  <strong>{slot.label}</strong>
                  <span>{slot.slotType === 'singles' ? '1 player' : '2 players'}</span>
                </div>
                <div className={styles.playerFields}>
                  {slot.players.map((player, playerIndex) => {
                    const ownKey = player.playerId || player.playerName.toLowerCase()
                    return (
                      <label key={`${slot.id}-${playerIndex}`}>
                        <span>{slot.slotType === 'singles' ? 'Player' : `Player ${playerIndex + 1}`}</span>
                        <select value={player.playerId || (player.playerName ? `name:${player.playerName}` : '')} onChange={(event) => choosePlayer(slotIndex, playerIndex, event.target.value)}>
                          <option value="">Open spot</option>
                          {review.roster.map((rosterPlayer) => (
                            <option
                              key={rosterPlayer.id || rosterPlayer.name}
                              value={rosterPlayer.id || `name:${rosterPlayer.name}`}
                              disabled={assignedKeys.has(rosterPlayer.id || rosterPlayer.name.toLowerCase()) && ownKey !== (rosterPlayer.id || rosterPlayer.name.toLowerCase())}
                            >
                              {rosterPlayer.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  })}
                </div>
              </article>
            ))}
          </section>

          <section className={styles.noteCard}>
            <label>
              <span>Your name <small>optional</small></span>
              <input value={reviewerName} maxLength={100} onChange={(event) => setReviewerName(event.target.value)} placeholder="So the captain knows who reviewed it" />
            </label>
            <label>
              <span>Quick note <small>optional</small></span>
              <textarea value={reviewerNote} maxLength={500} onChange={(event) => setReviewerNote(event.target.value)} placeholder="Why this version works better" rows={3} />
            </label>
          </section>

          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          <div className={styles.stickyAction}>
            <button className={styles.primaryAction} type="button" onClick={() => void submitSuggestion()} disabled={saving}>
              {saving ? 'Saving suggestion…' : 'Save & text back'}
            </button>
            <span>{changedCourts ? `${changedCourts} court${changedCourts === 1 ? '' : 's'} changed` : 'No changes yet'}</span>
          </div>
        </>
      )}
    </main>
  )
}
