'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TeamAvailabilitySummary } from '@/lib/team-availability-summary'

export type CaptainMatchWeekReadiness = {
  summary: TeamAvailabilitySummary
  selection: 'draft' | 'saved' | 'choose' | 'none'
  scenarioId: string
  checkedAt: string
  dayScopedAnswersOmitted: boolean
}

export type CaptainMatchWeekReadinessScope = {
  competitionLayer?: string
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponentTeam: string
}

export function useCaptainMatchWeekReadiness(input: {
  accessToken?: string | null
  enabled: boolean
  scope: CaptainMatchWeekReadinessScope
}) {
  const [result, setResult] = useState<{
    scopeKey: string
    readiness: CaptainMatchWeekReadiness | null
    status: 'ready' | 'local'
  }>({ scopeKey: '', readiness: null, status: 'ready' })
  const scopeKey = useMemo(() => JSON.stringify(input.scope), [input.scope])
  const readyForFetch = Boolean(
    input.enabled
    && input.accessToken
    && input.scope.teamName
    && input.scope.leagueName
    && input.scope.flight
    && input.scope.opponentTeam
    && /^\d{4}-\d{2}-\d{2}$/.test(input.scope.matchDate),
  )

  useEffect(() => {
    if (!readyForFetch) return
    const scope = JSON.parse(scopeKey) as CaptainMatchWeekReadinessScope
    const accessToken = input.accessToken || ''
    let active = true
    let running = false
    let controller: AbortController | null = null

    async function load() {
      if (!active || running) return
      running = true
      controller?.abort()
      controller = new AbortController()
      const params = new URLSearchParams({
        team: scope.teamName,
        league: scope.leagueName,
        flight: scope.flight,
        date: scope.matchDate,
        opponent: scope.opponentTeam,
      })
      if (scope.competitionLayer) params.set('layer', scope.competitionLayer)
      try {
        const response = await fetch(`/api/captain/team-availability-summary?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json() as CaptainMatchWeekReadiness & { message?: string }
        if (!response.ok || !payload.summary) throw new Error(payload.message || 'Match replies could not load.')
        if (active) setResult({ scopeKey, readiness: payload, status: 'ready' })
      } catch (cause) {
        if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setResult({ scopeKey, readiness: null, status: 'local' })
      } finally {
        running = false
      }
    }

    void load()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const timer = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener('focus', refreshWhenVisible)
    window.addEventListener('pageshow', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [input.accessToken, readyForFetch, scopeKey])

  const isCurrentScope = readyForFetch && result.scopeKey === scopeKey
  return {
    readiness: isCurrentScope ? result.readiness : null,
    status: !readyForFetch ? 'idle' as const : isCurrentScope ? result.status : 'loading' as const,
  }
}
