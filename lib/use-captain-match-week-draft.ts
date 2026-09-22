'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  readCaptainLineupBuilderDraft,
  type CaptainLineupBuilderDraft,
  type CaptainLineupDraftScope,
  type CaptainMatchWeekDetails,
} from '@/lib/captain-lineup-handoff'

export type CaptainMatchWeekCourt = {
  id: string
  label: string
  slotType: 'singles' | 'doubles'
  players: string[]
}

export type CaptainMatchWeekView = {
  courts: CaptainMatchWeekCourt[]
  details: CaptainMatchWeekDetails
  updatedAt: string
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function buildCaptainMatchWeekView(draft: CaptainLineupBuilderDraft): CaptainMatchWeekView {
  const courts = Array.isArray(draft.teamSlots)
    ? draft.teamSlots.map((slot, index) => {
        const source = slot && typeof slot === 'object' ? slot as Record<string, unknown> : {}
        const slotType = source.slotType === 'doubles' ? 'doubles' as const : 'singles' as const
        const players = Array.isArray(source.players)
          ? source.players.map((player) => {
              const entry = player && typeof player === 'object' ? player as Record<string, unknown> : {}
              return clean(entry.playerName)
            }).filter(Boolean)
          : []
        return {
          id: clean(source.id) || `court-${index + 1}`,
          label: clean(source.label) || `Court ${index + 1}`,
          slotType,
          players,
        }
      })
    : []

  return {
    courts,
    details: draft.matchDetails || { location: '', directions: '', arrivalTime: '', notes: '' },
    updatedAt: draft.matchWeekUpdatedAt || draft.updatedAt || '',
  }
}

export function useCaptainMatchWeekDraft(input: {
  accessToken?: string | null
  enabled: boolean
  scope: CaptainLineupDraftScope
}) {
  const [result, setResult] = useState<{
    scopeKey: string
    draft: CaptainLineupBuilderDraft | null
    status: 'ready' | 'local'
  }>({ scopeKey: '', draft: null, status: 'ready' })
  const scopeKey = useMemo(() => JSON.stringify(input.scope), [input.scope])
  const readyForFetch = Boolean(
    input.enabled
    && input.accessToken
    && input.scope.teamName
    && input.scope.leagueName
    && input.scope.flight
    && /^\d{4}-\d{2}-\d{2}$/.test(input.scope.matchDate),
  )

  useEffect(() => {
    const scope = JSON.parse(scopeKey) as CaptainLineupDraftScope
    const accessToken = input.accessToken || ''
    if (!readyForFetch) return

    let active = true
    const controller = new AbortController()
    const params = new URLSearchParams(scope)
    void fetch(`/api/captain/lineup-drafts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('Match Week could not load.')
      const result = await response.json() as { draft?: unknown }
      return readCaptainLineupBuilderDraft(JSON.stringify(result.draft ?? null))
    }).then((nextDraft) => {
      if (!active) return
      setResult({ scopeKey, draft: nextDraft, status: 'ready' })
    }).catch((cause) => {
      if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return
      setResult({ scopeKey, draft: null, status: 'local' })
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [input.accessToken, readyForFetch, scopeKey])

  const isCurrentScope = readyForFetch && result.scopeKey === scopeKey
  const draft = isCurrentScope ? result.draft : null

  return {
    draft,
    matchWeek: useMemo(() => draft ? buildCaptainMatchWeekView(draft) : null, [draft]),
    status: !readyForFetch ? 'idle' as const : isCurrentScope ? result.status : 'loading' as const,
  }
}
