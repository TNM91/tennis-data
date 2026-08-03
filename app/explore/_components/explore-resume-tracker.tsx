'use client'

import { useEffect } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { syncExploreResumeState, type ExploreResumeSurface } from '@/lib/explore-memory'

export default function ExploreResumeTracker({
  surface,
  label,
  href,
  contextLabel,
  enabled = true,
}: {
  surface: ExploreResumeSurface
  label: string
  href: string
  contextLabel?: string
  enabled?: boolean
}) {
  const { userId, authResolved, session } = useAuth()

  useEffect(() => {
    if (!enabled || !authResolved || !userId) return
    const timer = window.setTimeout(() => {
      void syncExploreResumeState({
        lastSurface: surface,
        lastSurfaceLabel: label,
        lastHref: href,
        lastVisitedAt: new Date().toISOString(),
        ...(contextLabel ? { contextLabel } : {}),
      }, userId, session?.access_token)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [authResolved, contextLabel, enabled, href, label, session?.access_token, surface, userId])

  return null
}
