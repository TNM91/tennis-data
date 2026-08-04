'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { readCaptainResumeState } from '@/lib/captain-memory'
import { readCoachResumeState } from '@/lib/coach-memory'
import { readCompeteResumeState } from '@/lib/compete-memory'
import { readExploreResumeState } from '@/lib/explore-memory'
import { readLeagueCoordinatorResumeState } from '@/lib/league-coordinator-memory'
import {
  getPlatformResumeCompletionMessage,
  PLATFORM_RESUME_UPDATED_EVENT,
} from '@/lib/platform-resume-events'
import {
  buildPlatformResumeCandidates,
  mergePlatformResumeCandidates,
  sanitizePlatformResumeCandidates,
  type PlatformResumeCandidate,
} from '@/lib/platform-resume'
import { readPlayerImproveResumeState } from '@/lib/player-improve-memory'

export function usePlatformResume({
  accessToken,
  userId,
  refreshKey,
}: {
  accessToken?: string | null
  userId?: string | null
  refreshKey?: string | null
}) {
  const [localCandidates, setLocalCandidates] = useState<PlatformResumeCandidate[]>([])
  const [cloudCandidates, setCloudCandidates] = useState<PlatformResumeCandidate[]>([])
  const [confirmation, setConfirmation] = useState('')
  const previousLocalCandidatesRef = useRef<PlatformResumeCandidate[] | null>(null)
  const previousUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    let timeout: number | null = null
    if (previousUserIdRef.current !== userId) {
      previousUserIdRef.current = userId
      previousLocalCandidatesRef.current = null
    }

    const loadLocalCandidates = () => {
      timeout = null
      if (!userId) {
        previousLocalCandidatesRef.current = null
        setLocalCandidates([])
        return
      }

      const captain = readCaptainResumeState(userId)
      const teamRoomDraftPending = Boolean(
        captain?.teamRoomId && window.localStorage.getItem(`tenaceiq-team-room-draft:${captain.teamRoomId}`)?.trim(),
      )
      const nextCandidates = buildPlatformResumeCandidates({
        captain,
        coach: readCoachResumeState(userId),
        improve: readPlayerImproveResumeState(userId),
        compete: readCompeteResumeState(userId),
        explore: readExploreResumeState(userId),
        league: readLeagueCoordinatorResumeState(userId),
        teamRoomDraftPending,
      })
      const previousCandidates = previousLocalCandidatesRef.current
      const previousUnfinished = previousCandidates?.find((item) => item.status === 'unfinished')
      const unfinishedStillOpen = previousUnfinished
        ? nextCandidates.some((item) => (
          item.status === 'unfinished'
          && item.id === previousUnfinished.id
          && item.actionLabel === previousUnfinished.actionLabel
        ))
        : true

      if (previousUnfinished && !unfinishedStillOpen) {
        setConfirmation(getPlatformResumeCompletionMessage(previousUnfinished.actionLabel))
      }
      previousLocalCandidatesRef.current = nextCandidates
      setLocalCandidates(nextCandidates)
    }

    const scheduleLocalRefresh = () => {
      if (timeout !== null) window.clearTimeout(timeout)
      timeout = window.setTimeout(loadLocalCandidates, 40)
    }
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') scheduleLocalRefresh()
    }

    scheduleLocalRefresh()
    window.addEventListener(PLATFORM_RESUME_UPDATED_EVENT, scheduleLocalRefresh)
    window.addEventListener('storage', scheduleLocalRefresh)
    window.addEventListener('pageshow', scheduleLocalRefresh)
    document.addEventListener('visibilitychange', refreshOnVisible)
    return () => {
      if (timeout !== null) window.clearTimeout(timeout)
      window.removeEventListener(PLATFORM_RESUME_UPDATED_EVENT, scheduleLocalRefresh)
      window.removeEventListener('storage', scheduleLocalRefresh)
      window.removeEventListener('pageshow', scheduleLocalRefresh)
      document.removeEventListener('visibilitychange', refreshOnVisible)
    }
  }, [refreshKey, userId])

  useEffect(() => {
    let active = true

    async function loadCloudCandidates() {
      if (!accessToken || !userId) {
        window.setTimeout(() => {
          if (active) setCloudCandidates([])
        }, 0)
        return
      }

      try {
        const response = await fetch('/api/resume/overview', {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        })
        if (!response.ok) return
        const payload = await response.json() as { candidates?: unknown }
        if (active) setCloudCandidates(sanitizePlatformResumeCandidates(payload.candidates))
      } catch {
        // Device history still provides a useful shortcut while cloud restore recovers.
      }
    }

    const refreshCloudOnVisible = () => {
      if (document.visibilityState === 'visible') void loadCloudCandidates()
    }
    void loadCloudCandidates()
    window.addEventListener('pageshow', loadCloudCandidates)
    document.addEventListener('visibilitychange', refreshCloudOnVisible)
    return () => {
      active = false
      window.removeEventListener('pageshow', loadCloudCandidates)
      document.removeEventListener('visibilitychange', refreshCloudOnVisible)
    }
  }, [accessToken, userId])

  useEffect(() => {
    if (!confirmation) return
    const timeout = window.setTimeout(() => setConfirmation(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [confirmation])

  const items = useMemo(
    () => mergePlatformResumeCandidates(localCandidates, cloudCandidates),
    [cloudCandidates, localCandidates],
  )

  return useMemo(() => ({ items, confirmation }), [confirmation, items])
}
