'use client'

import { useEffect, useMemo, useState } from 'react'
import { readCaptainResumeState } from '@/lib/captain-memory'
import { readCoachResumeState } from '@/lib/coach-memory'
import { readCompeteResumeState } from '@/lib/compete-memory'
import { readExploreResumeState } from '@/lib/explore-memory'
import { readLeagueCoordinatorResumeState } from '@/lib/league-coordinator-memory'
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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!userId) {
        setLocalCandidates([])
        return
      }

      const captain = readCaptainResumeState(userId)
      const teamRoomDraftPending = Boolean(
        captain?.teamRoomId && window.localStorage.getItem(`tenaceiq-team-room-draft:${captain.teamRoomId}`)?.trim(),
      )
      setLocalCandidates(buildPlatformResumeCandidates({
        captain,
        coach: readCoachResumeState(userId),
        improve: readPlayerImproveResumeState(userId),
        compete: readCompeteResumeState(userId),
        explore: readExploreResumeState(userId),
        league: readLeagueCoordinatorResumeState(userId),
        teamRoomDraftPending,
      }))
    }, 0)

    return () => window.clearTimeout(timeout)
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

    void loadCloudCandidates()
    return () => {
      active = false
    }
  }, [accessToken, userId])

  return useMemo(
    () => mergePlatformResumeCandidates(localCandidates, cloudCandidates),
    [cloudCandidates, localCandidates],
  )
}
