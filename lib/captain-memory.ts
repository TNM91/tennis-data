import { notifyPlatformResumeUpdated } from './platform-resume-events'

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
  | 'team-room'

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
  matchId?: string
  scenarioId?: string
  teamRoomId?: string
  weekStatus?: 'draft-lineup' | 'ready-to-send' | 'finalized'
  lineupCount?: number
  pendingResponseCount?: number
  lastHref?: string
}

const CAPTAIN_TOOL_KEYS = new Set<CaptainToolKey>([
  'hub',
  'availability',
  'lineup-builder',
  'lineup-projection',
  'messaging',
  'analytics',
  'scenario-builder',
  'lineup-availability',
  'weekly-brief',
  'team-brief',
  'season-dashboard',
  'tiq-team-matches',
  'team-room',
])

function cleanResumeText(value: unknown, maxLength = 180) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function cleanResumeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(999, Math.round(value)))
    : undefined
}

export function isSafeCaptainResumeHref(value: unknown): value is string {
  const href = cleanResumeText(value, 1200)
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false

  try {
    const parsed = new URL(href, 'https://www.tenaceiq.com')
    return parsed.origin === 'https://www.tenaceiq.com'
  } catch {
    return false
  }
}

export function sanitizeCaptainResumeState(value: unknown): CaptainResumeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const lastTool = cleanResumeText(input.lastTool) as CaptainToolKey
  const weekStatus = input.weekStatus === 'draft-lineup' || input.weekStatus === 'ready-to-send' || input.weekStatus === 'finalized'
    ? input.weekStatus
    : undefined
  const lineupCount = cleanResumeCount(input.lineupCount)
  const pendingResponseCount = cleanResumeCount(input.pendingResponseCount)
  const lastHref = isSafeCaptainResumeHref(input.lastHref) ? cleanResumeText(input.lastHref, 1200) : ''

  return {
    ...(cleanResumeText(input.competitionLayer) ? { competitionLayer: cleanResumeText(input.competitionLayer) } : {}),
    ...(cleanResumeText(input.team) ? { team: cleanResumeText(input.team) } : {}),
    ...(cleanResumeText(input.league) ? { league: cleanResumeText(input.league) } : {}),
    ...(cleanResumeText(input.flight) ? { flight: cleanResumeText(input.flight) } : {}),
    ...(CAPTAIN_TOOL_KEYS.has(lastTool) ? { lastTool } : {}),
    ...(cleanResumeText(input.lastToolLabel, 80) ? { lastToolLabel: cleanResumeText(input.lastToolLabel, 80) } : {}),
    ...(cleanResumeText(input.lastVisitedAt, 80) ? { lastVisitedAt: cleanResumeText(input.lastVisitedAt, 80) } : {}),
    ...(cleanResumeText(input.eventDate, 40) ? { eventDate: cleanResumeText(input.eventDate, 40) } : {}),
    ...(cleanResumeText(input.opponentTeam) ? { opponentTeam: cleanResumeText(input.opponentTeam) } : {}),
    ...(cleanResumeText(input.matchId, 120) ? { matchId: cleanResumeText(input.matchId, 120) } : {}),
    ...(cleanResumeText(input.scenarioId, 120) ? { scenarioId: cleanResumeText(input.scenarioId, 120) } : {}),
    ...(cleanResumeText(input.teamRoomId, 120) ? { teamRoomId: cleanResumeText(input.teamRoomId, 120) } : {}),
    ...(weekStatus ? { weekStatus } : {}),
    ...(lineupCount === undefined ? {} : { lineupCount }),
    ...(pendingResponseCount === undefined ? {} : { pendingResponseCount }),
    ...(lastHref ? { lastHref } : {}),
  }
}

function resumeTimestamp(state: CaptainResumeState | null | undefined) {
  const timestamp = Date.parse(state?.lastVisitedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function chooseLatestCaptainResumeState(
  localState: CaptainResumeState | null,
  cloudState: CaptainResumeState | null,
) {
  if (!localState) return cloudState
  if (!cloudState) return localState
  return resumeTimestamp(cloudState) > resumeTimestamp(localState) ? cloudState : localState
}

export function getCaptainResumeHref(state: CaptainResumeState | null | undefined) {
  if (!state || state.lastTool === 'hub') return ''
  if (isSafeCaptainResumeHref(state.lastHref)) return state.lastHref

  const pathByTool: Partial<Record<CaptainToolKey, string>> = {
    availability: '/captain/availability',
    'lineup-builder': '/captain/lineup-builder',
    'lineup-projection': '/captain/lineup-projection',
    messaging: '/captain/messaging',
    analytics: '/captain/analytics',
    'scenario-builder': '/captain/scenario-builder',
    'lineup-availability': '/captain/lineup-availability',
    'weekly-brief': '/captain/weekly-brief',
    'team-brief': '/captain/team-brief',
    'team-room': '/team-room',
  }
  const path = state.lastTool ? pathByTool[state.lastTool] : ''
  if (!path) return ''

  return buildCaptainScopedHref(path, {
    competitionLayer: state.competitionLayer,
    team: state.team,
    league: state.league,
    flight: state.flight,
    date: state.eventDate,
    opponent: state.opponentTeam,
    matchId: state.matchId,
    scenarioId: state.scenarioId,
  })
}

export function readCaptainResumeState(userId?: string | null): CaptainResumeState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getCaptainResumeStorageKey(userId))
    if (!raw) return null
    return sanitizeCaptainResumeState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeCaptainResumeState(nextState: CaptainResumeState, userId?: string | null) {
  if (typeof window === 'undefined') return null

  try {
    const storageKey = getCaptainResumeStorageKey(userId)
    const current = readCaptainResumeState(userId) || {}
    const saved = sanitizeCaptainResumeState({
      ...current,
      ...nextState,
      lastVisitedAt: nextState.lastVisitedAt || new Date().toISOString(),
    })
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(saved),
    )
    notifyPlatformResumeUpdated('captain')
    return saved
  } catch {
    // ignore storage failures
    return null
  }
}

export async function loadCaptainResumeStateFromCloud(accessToken: string) {
  if (!accessToken) return null
  try {
    const response = await fetch('/api/captain/resume', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json() as { resume?: unknown }
    const resume = sanitizeCaptainResumeState(payload.resume)
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export async function syncCaptainResumeState(
  nextState: CaptainResumeState,
  userId?: string | null,
  accessToken?: string | null,
) {
  const saved = writeCaptainResumeState(nextState, userId)
  if (!saved || !accessToken) return saved

  try {
    await fetch('/api/captain/resume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resume: saved }),
      keepalive: true,
    })
  } catch {
    // Local resume remains available if cloud sync is temporarily unavailable.
  }
  return saved
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
    matchId?: string
    scenarioId?: string
  },
) {
  const params = new URLSearchParams()

  if (scope.competitionLayer) params.set('layer', scope.competitionLayer)
  if (scope.team) params.set('team', scope.team)
  if (scope.league) params.set('league', scope.league)
  if (scope.flight) params.set('flight', scope.flight)
  if (scope.date) params.set('date', scope.date)
  if (scope.opponent) params.set('opponent', scope.opponent)
  if (scope.matchId) params.set('match', scope.matchId)
  if (scope.scenarioId) params.set('scenario', scope.scenarioId)

  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/**
 * A scoped Captain link is an intentional team or match selection.  It must
 * take precedence over a recoverable device draft from a different team.
 */
export function hasExplicitCaptainRouteScope(params: URLSearchParams) {
  return ['layer', 'team', 'league', 'flight', 'date', 'opponent', 'match', 'scenario', 'left']
    .some((key) => Boolean(params.get(key)?.trim()))
}

function isPastCaptainMatchDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const matchDay = new Date(`${value}T12:00:00`).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Number.isFinite(matchDay) && matchDay < today.getTime()
}

/**
 * A new Lineup Builder entry always starts at the next Match Week. A saved
 * match is restored only by an explicit date/opponent/match link (such as
 * Continue), never by a generic Teams or Captain shortcut.
 */
export function resolveCaptainMatchContext(params: URLSearchParams) {
  const eventDate = params.get('date') || ''
  const isHistorical = isPastCaptainMatchDate(eventDate)
  return {
    eventDate: isHistorical ? '' : eventDate,
    opponentTeam: isHistorical ? '' : (params.get('opponent') || ''),
    matchId: isHistorical ? '' : (params.get('match') || ''),
  }
}
