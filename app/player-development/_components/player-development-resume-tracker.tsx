'use client'

import { useEffect } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  chooseLatestPlayerImproveResumeState,
  loadPlayerImproveResumeStateFromCloud,
  readPlayerImproveResumeState,
  syncPlayerImproveResumeState,
  writePlayerImproveResumeState,
  type PlayerImproveResumeState,
} from '@/lib/player-improve-memory'

export default function PlayerDevelopmentResumeTracker({
  identitySlug,
  identityTitle,
}: {
  identitySlug: string
  identityTitle: string
}) {
  const { userId, authResolved, session } = useAuth()

  useEffect(() => {
    if (!authResolved || !userId) return

    const accessToken = session?.access_token || ''
    let active = true
    const timeout = window.setTimeout(() => {
      void (async () => {
        const localState = readPlayerImproveResumeState(userId)
        const cloudState = accessToken ? await loadPlayerImproveResumeStateFromCloud(accessToken) : null
        if (!active) return
        const current = chooseLatestPlayerImproveResumeState(localState, cloudState)
        const nextState: PlayerImproveResumeState = {
          ...current,
          identitySlug,
          identityTitle,
          lastSurface: 'player-path',
          lastSurfaceLabel: 'Player Path',
          lastHref: `/player-development/${encodeURIComponent(identitySlug)}`,
          lastVisitedAt: new Date().toISOString(),
        }
        writePlayerImproveResumeState(nextState, userId)
        void syncPlayerImproveResumeState(nextState, userId, accessToken)
      })()
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [authResolved, identitySlug, identityTitle, session?.access_token, userId])

  return null
}
