'use client'

export const CAPTAIN_RESUME_STORAGE_KEY = 'tenaceiq_captain_resume'

export function getCaptainResumeStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${CAPTAIN_RESUME_STORAGE_KEY}:${accountId}` : CAPTAIN_RESUME_STORAGE_KEY
}

export type CaptainToolKey =
  | 'hub'
  | 'availability'
  | 'lineup-builder'
  | 'lineup-projection'
  | 'messaging'
  | 'analytics'
  | 'scenario-builder'
  | 'lineup-availability'
  | 'weekly-brief'
  | 'team-brief'
  | 'season-dashboard'
  | 'tiq-team-matches'

export type CaptainResumeState = {
  competitionLayer?: string
  team?: string
  league?: string
  flight?: string
  lastTool?: CaptainToolKey
  lastToolLabel?: string
  lastVisitedAt?: string
  eventDate?: string
  opponentTeam?: string
}

export function readCaptainResumeState(userId?: string | null): CaptainResumeState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getCaptainResumeStorageKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as CaptainResumeState
  } catch {
    return null
  }
}

export function writeCaptainResumeState(nextState: CaptainResumeState, userId?: string | null) {
  if (typeof window === 'undefined') return

  try {
    const storageKey = getCaptainResumeStorageKey(userId)
    const current = readCaptainResumeState(userId) || {}
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...current,
        ...nextState,
        lastVisitedAt: nextState.lastVisitedAt || new Date().toISOString(),
      }),
    )
  } catch {
    // ignore storage failures
  }
}

export function buildCaptainScopedHref(
  path: string,
  scope: {
    competitionLayer?: string
    team?: string
    league?: string
    flight?: string
    date?: string
    opponent?: string
  },
) {
  const params = new URLSearchParams()

  if (scope.competitionLayer) params.set('layer', scope.competitionLayer)
  if (scope.team) params.set('team', scope.team)
  if (scope.league) params.set('league', scope.league)
  if (scope.flight) params.set('flight', scope.flight)
  if (scope.date) params.set('date', scope.date)
  if (scope.opponent) params.set('opponent', scope.opponent)

  const query = params.toString()
  return query ? `${path}?${query}` : path
}
