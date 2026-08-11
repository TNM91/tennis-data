'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  applyPlatformResumeHandoff,
  buildPlatformResumeHandoff,
  buildPlatformResumeCandidates,
  mergePlatformResumeCandidates,
  sanitizePlatformResumeCandidates,
  type PlatformResumeCandidate,
  type PlatformResumeHandoff,
} from '@/lib/platform-resume'
import {
  filterPlatformResumeCandidates,
  getPlatformResumeFingerprint,
  readPlatformResumeSuppressions,
  removePlatformResumeSuppression,
  suppressPlatformResumeCandidate,
  syncPlatformResumeSuppressionsWithCloud,
  type PlatformResumeSuppression,
} from '@/lib/platform-resume-preferences'
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
  const [suppressions, setSuppressions] = useState<PlatformResumeSuppression[]>([])
  const [handoff, setHandoff] = useState<PlatformResumeHandoff | null>(null)
  const [notice, setNotice] = useState<{ message: string; undoFingerprint?: string }>({ message: '' })
  const previousLocalCandidatesRef = useRef<PlatformResumeCandidate[] | null>(null)
  const previousUserIdRef = useRef<string | null | undefined>(undefined)
  const suppressionSyncRef = useRef<Promise<PlatformResumeSuppression[] | null> | null>(null)

  useEffect(() => {
    let timeout: number | null = null
    let clearHandoffForUserChange = previousUserIdRef.current !== userId
    if (clearHandoffForUserChange) {
      previousUserIdRef.current = userId
      previousLocalCandidatesRef.current = null
    }

    const loadLocalCandidates = () => {
      timeout = null
      if (clearHandoffForUserChange) {
        clearHandoffForUserChange = false
        setHandoff(null)
      }
      if (!userId) {
        previousLocalCandidatesRef.current = null
        setLocalCandidates([])
        setSuppressions([])
        setHandoff(null)
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
      const nextHandoff = buildPlatformResumeHandoff(previousCandidates, nextCandidates)

      if (nextHandoff) {
        setHandoff(nextHandoff)
        setNotice({ message: getPlatformResumeCompletionMessage(nextHandoff.completedActionLabel) })
      } else {
        setHandoff((current) => {
          if (!current) return null
          const currentLane = nextCandidates.find((candidate) => candidate.id === current.candidate.id)
          return currentLane?.visitedAt === current.candidate.visitedAt ? current : null
        })
      }
      previousLocalCandidatesRef.current = nextCandidates
      setLocalCandidates(nextCandidates)
      setSuppressions(readPlatformResumeSuppressions(userId))
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

  const syncCloudSuppressions = useCallback(() => {
    if (!accessToken || !userId) return Promise.resolve(null)
    if (suppressionSyncRef.current) return suppressionSyncRef.current

    const request = syncPlatformResumeSuppressionsWithCloud(accessToken, userId)
      .finally(() => {
        if (suppressionSyncRef.current === request) suppressionSyncRef.current = null
      })
    suppressionSyncRef.current = request
    return request
  }, [accessToken, userId])

  useEffect(() => {
    let active = true
    const refreshCloudSuppressions = () => {
      void syncCloudSuppressions().then((nextSuppressions) => {
        if (active && nextSuppressions) setSuppressions(nextSuppressions)
      })
    }
    const refreshCloudSuppressionsOnVisible = () => {
      if (document.visibilityState === 'visible') refreshCloudSuppressions()
    }

    refreshCloudSuppressions()
    window.addEventListener('pageshow', refreshCloudSuppressions)
    window.addEventListener('online', refreshCloudSuppressions)
    document.addEventListener('visibilitychange', refreshCloudSuppressionsOnVisible)
    return () => {
      active = false
      window.removeEventListener('pageshow', refreshCloudSuppressions)
      window.removeEventListener('online', refreshCloudSuppressions)
      document.removeEventListener('visibilitychange', refreshCloudSuppressionsOnVisible)
    }
  }, [syncCloudSuppressions])

  useEffect(() => {
    if (!notice.message) return
    const timeout = window.setTimeout(() => setNotice({ message: '' }), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice.message])

  useEffect(() => {
    const nextExpiry = suppressions.reduce((earliest, entry) => {
      if (entry.mode !== 'later') return earliest
      const timestamp = Date.parse(entry.until || '')
      return Number.isFinite(timestamp) && timestamp < earliest ? timestamp : earliest
    }, Number.POSITIVE_INFINITY)
    if (!Number.isFinite(nextExpiry)) return
    const timeout = window.setTimeout(() => {
      setSuppressions(readPlatformResumeSuppressions(userId))
    }, Math.max(0, nextExpiry - Date.now()) + 50)
    return () => window.clearTimeout(timeout)
  }, [suppressions, userId])

  const suppressItem = useCallback((candidate: PlatformResumeCandidate, mode: PlatformResumeSuppression['mode']) => {
    if (!userId) return
    const fingerprint = getPlatformResumeFingerprint(candidate)
    const nextSuppressions = suppressPlatformResumeCandidate(candidate, mode, userId)
    setSuppressions(nextSuppressions)
    if (!nextSuppressions.some((entry) => entry.fingerprint === fingerprint)) {
      setNotice({ message: 'Could not update shortcut.' })
      return
    }
    setNotice({
      message: mode === 'later' ? 'Moved to Later.' : 'Shortcut hidden.',
      undoFingerprint: fingerprint,
    })
    void syncCloudSuppressions().then((synced) => {
      if (synced) setSuppressions(synced)
    })
  }, [syncCloudSuppressions, userId])

  const undoLastSuppression = useCallback(() => {
    if (!userId || !notice.undoFingerprint) return
    const nextSuppressions = removePlatformResumeSuppression(notice.undoFingerprint, userId)
    setSuppressions(nextSuppressions)
    setNotice({
      message: nextSuppressions.some((entry) => entry.fingerprint === notice.undoFingerprint)
        ? 'Could not restore shortcut.'
        : 'Shortcut restored.',
    })
    void syncCloudSuppressions().then((synced) => {
      if (synced) setSuppressions(synced)
    })
  }, [notice.undoFingerprint, syncCloudSuppressions, userId])

  const items = useMemo(
    () => filterPlatformResumeCandidates(
      applyPlatformResumeHandoff(
        mergePlatformResumeCandidates(localCandidates, cloudCandidates),
        handoff,
      ),
      suppressions,
    ),
    [cloudCandidates, handoff, localCandidates, suppressions],
  )

  return useMemo(() => ({
    items,
    confirmation: notice.message,
    canUndo: Boolean(notice.undoFingerprint),
    snoozeItem: (candidate: PlatformResumeCandidate) => suppressItem(candidate, 'later'),
    hideItem: (candidate: PlatformResumeCandidate) => suppressItem(candidate, 'hidden'),
    undoLastSuppression,
  }), [items, notice.message, notice.undoFingerprint, suppressItem, undoLastSuppression])
}
