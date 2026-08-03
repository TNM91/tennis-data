'use client'

import { useEffect } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { syncCompeteResumeState, type CompeteResumeState, type CompeteResumeSurface } from '@/lib/compete-memory'

type CompeteResumeTrackerProps = {
  surface: CompeteResumeSurface
  label: string
  href: string
  tournamentId?: string
  tournamentName?: string
  leagueId?: string
  leagueName?: string
  matchupLabel?: string
  enabled?: boolean
}

export default function CompeteResumeTracker({
  surface,
  label,
  href,
  tournamentId,
  tournamentName,
  leagueId,
  leagueName,
  matchupLabel,
  enabled = true,
}: CompeteResumeTrackerProps) {
  const { userId, authResolved, session } = useAuth()

  useEffect(() => {
    if (!enabled || !authResolved || !userId) return
    const timer = window.setTimeout(() => {
      const nextState: CompeteResumeState = {
        lastSurface: surface,
        lastSurfaceLabel: label,
        lastHref: href,
        lastVisitedAt: new Date().toISOString(),
        ...(tournamentId ? { tournamentId } : {}),
        ...(tournamentName ? { tournamentName } : {}),
        ...(leagueId ? { leagueId } : {}),
        ...(leagueName ? { leagueName } : {}),
        ...(matchupLabel ? { matchupLabel } : {}),
      }
      void syncCompeteResumeState(nextState, userId, session?.access_token)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [
    authResolved,
    enabled,
    href,
    label,
    leagueId,
    leagueName,
    matchupLabel,
    session?.access_token,
    surface,
    tournamentId,
    tournamentName,
    userId,
  ])

  return null
}
