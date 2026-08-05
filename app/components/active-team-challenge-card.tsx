'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import styles from '@/app/components/active-team-challenge-card.module.css'

type ActiveTeamChallenge = {
  messageId: string
  id: string
  title: string
  focus: string
  teamName: string
  leagueName: string
  flight: string
  cardIds: string[]
  completedCardIds: string[]
  completed: boolean
  completedCount: number
  connectedCount: number
  resumeHref: string
  teamRoomHref: string
}

type TeamRoomSummaryResponse = {
  ok?: boolean
  summary?: {
    activeChallenge?: ActiveTeamChallenge | null
    activeChallenges?: ActiveTeamChallenge[]
  }
}

type LoadedChallengeSummary = {
  activeChallenge: ActiveTeamChallenge | null
  activeChallenges: ActiveTeamChallenge[]
}

export default function ActiveTeamChallengeCard() {
  const { authResolved, session, userId } = useAuth()
  const [loaded, setLoaded] = useState<{ userId: string; summary: LoadedChallengeSummary } | null>(null)

  useEffect(() => {
    if (!authResolved) return
    const accessToken = session?.access_token || ''
    const currentUserId = userId || ''
    if (!accessToken || !currentUserId) return

    const controller = new AbortController()
    void fetch('/api/team-rooms?activeChallenge=1', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return { activeChallenge: null, activeChallenges: [] }
        const payload = await response.json() as TeamRoomSummaryResponse
        const activeChallenge = payload.ok ? payload.summary?.activeChallenge || null : null
        return {
          activeChallenge,
          activeChallenges: payload.ok
            ? payload.summary?.activeChallenges || (activeChallenge ? [activeChallenge] : [])
            : [],
        }
      })
      .then((summary) => setLoaded({ userId: currentUserId, summary }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoaded({
          userId: currentUserId,
          summary: { activeChallenge: null, activeChallenges: [] },
        })
      })

    return () => controller.abort()
  }, [authResolved, session?.access_token, userId])

  const summary = userId && loaded?.userId === userId ? loaded.summary : null
  const challenge = summary?.activeChallenge || null
  if (!challenge) return null

  const otherChallenges = summary?.activeChallenges.filter((item) => item.messageId !== challenge.messageId) || []

  const totalCards = Math.max(1, challenge.cardIds.length)
  const completedCards = Math.min(challenge.completedCardIds.length, totalCards)
  const progressPercent = Math.round((completedCards / totalCards) * 100)
  const teamScope = [challenge.teamName, challenge.leagueName, challenge.flight]
    .filter(Boolean)
    .join(' - ')

  return (
    <section className={styles.card} aria-label={`Active team challenge for ${challenge.teamName}`} data-team-challenge-resume>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Team challenge</p>
        <h2 className={styles.title}>{challenge.title}</h2>
        <p className={styles.team}>{teamScope}</p>
        <p className={styles.focus}>{challenge.focus}</p>
      </div>

      <div className={styles.progressBlock}>
        <div className={styles.progressLabel}>
          <span>{challenge.completed ? 'You finished' : 'Your progress'}</span>
          <strong>{completedCards} of {totalCards}</strong>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Your team challenge progress"
          aria-valuemin={0}
          aria-valuemax={totalCards}
          aria-valuenow={completedCards}
        >
          <span className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <p className={styles.teamProgress}>
          {challenge.completedCount} of {challenge.connectedCount} connected players complete
        </p>
      </div>

      <div className={styles.actions}>
        <Link className={styles.primaryAction} href={challenge.completed ? challenge.teamRoomHref : challenge.resumeHref}>
          {challenge.completed ? 'Open Team Hub' : 'Resume challenge'}
        </Link>
        {!challenge.completed ? (
          <Link className={styles.secondaryAction} href={challenge.teamRoomHref}>Open Team Hub</Link>
        ) : null}
      </div>

      {otherChallenges.length ? (
        <details className={styles.moreChallenges}>
          <summary className={styles.moreChallengesSummary}>
            <span>
              {otherChallenges.length} more team challenge{otherChallenges.length === 1 ? '' : 's'}
            </span>
            <span>Choose team</span>
          </summary>
          <div className={styles.moreChallengesList}>
            {otherChallenges.map((item) => {
              const itemCompletedCards = Math.min(item.completedCardIds.length, item.cardIds.length)
              const itemHref = item.completed ? item.teamRoomHref : item.resumeHref
              return (
                <Link
                  key={item.messageId}
                  className={styles.moreChallengeLink}
                  href={itemHref}
                  aria-label={`${item.completed ? 'Review' : 'Resume'} ${item.title} for ${item.teamName}`}
                >
                  <span className={styles.moreChallengeCopy}>
                    <strong>{item.teamName}</strong>
                    <span>{item.title} - {itemCompletedCards} of {item.cardIds.length}</span>
                  </span>
                  <span className={styles.moreChallengeAction}>{item.completed ? 'Review' : 'Resume'}</span>
                </Link>
              )
            })}
          </div>
        </details>
      ) : null}
    </section>
  )
}
