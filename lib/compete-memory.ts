export const COMPETE_RESUME_STORAGE_KEY = 'tenaceiq_compete_resume_v1'

export type CompeteResumeSurface =
  | 'compete'
  | 'matchup'
  | 'players'
  | 'teams'
  | 'leagues'
  | 'schedule'
  | 'results'
  | 'tournament'
  | 'tournament-entry'
  | 'tournament-alerts'

export type CompeteResumeState = {
  lastSurface?: CompeteResumeSurface
  lastSurfaceLabel?: string
  lastHref?: string
  lastVisitedAt?: string
  tournamentId?: string
  tournamentName?: string
  leagueId?: string
  leagueName?: string
  matchupLabel?: string
}

const SURFACES = new Set<CompeteResumeSurface>([
  'compete',
  'matchup',
  'players',
  'teams',
  'leagues',
  'schedule',
  'results',
  'tournament',
  'tournament-entry',
  'tournament-alerts',
])

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function getCompeteResumeStorageKey(userId?: string | null) {
  const accountId = cleanText(userId, 180)
  return accountId ? `${COMPETE_RESUME_STORAGE_KEY}:${accountId}` : COMPETE_RESUME_STORAGE_KEY
}

export function isSafeCompeteResumeHref(value: unknown): value is string {
  const href = cleanText(value, 1800)
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false
  try {
    const parsed = new URL(href, 'https://www.tenaceiq.com')
    return parsed.origin === 'https://www.tenaceiq.com'
  } catch {
    return false
  }
}

export function sanitizeCompeteResumeState(value: unknown): CompeteResumeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const lastSurface = cleanText(input.lastSurface) as CompeteResumeSurface
  const lastHref = isSafeCompeteResumeHref(input.lastHref) ? cleanText(input.lastHref, 1800) : ''

  return {
    ...(SURFACES.has(lastSurface) ? { lastSurface } : {}),
    ...(cleanText(input.lastSurfaceLabel, 120) ? { lastSurfaceLabel: cleanText(input.lastSurfaceLabel, 120) } : {}),
    ...(lastHref ? { lastHref } : {}),
    ...(cleanText(input.lastVisitedAt, 80) ? { lastVisitedAt: cleanText(input.lastVisitedAt, 80) } : {}),
    ...(cleanText(input.tournamentId, 180) ? { tournamentId: cleanText(input.tournamentId, 180) } : {}),
    ...(cleanText(input.tournamentName, 240) ? { tournamentName: cleanText(input.tournamentName, 240) } : {}),
    ...(cleanText(input.leagueId, 180) ? { leagueId: cleanText(input.leagueId, 180) } : {}),
    ...(cleanText(input.leagueName, 240) ? { leagueName: cleanText(input.leagueName, 240) } : {}),
    ...(cleanText(input.matchupLabel, 300) ? { matchupLabel: cleanText(input.matchupLabel, 300) } : {}),
  }
}

function resumeTimestamp(state: CompeteResumeState | null | undefined) {
  const timestamp = Date.parse(state?.lastVisitedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function chooseLatestCompeteResumeState(
  localState: CompeteResumeState | null,
  cloudState: CompeteResumeState | null,
) {
  if (!localState) return cloudState
  if (!cloudState) return localState
  return resumeTimestamp(cloudState) > resumeTimestamp(localState) ? cloudState : localState
}

export function getCompeteResumeHref(state: CompeteResumeState | null | undefined) {
  if (!state) return ''
  if (isSafeCompeteResumeHref(state.lastHref)) return state.lastHref
  if (state.lastSurface === 'tournament-alerts' && state.tournamentId) {
    return `/tournaments/${encodeURIComponent(state.tournamentId)}/preferences`
  }
  if ((state.lastSurface === 'tournament' || state.lastSurface === 'tournament-entry') && state.tournamentId) {
    const anchor = state.lastSurface === 'tournament-entry' ? '#enter-tournament' : ''
    return `/tournaments/${encodeURIComponent(state.tournamentId)}${anchor}`
  }
  if (state.lastSurface === 'leagues' && state.leagueName) {
    return `/explore/leagues/tiq/${encodeURIComponent(state.leagueName)}${state.leagueId ? `?league_id=${encodeURIComponent(state.leagueId)}` : ''}`
  }
  if (state.lastSurface === 'schedule') return '/compete/schedule'
  if (state.lastSurface === 'results') return '/compete/results'
  if (state.lastSurface === 'teams') return '/compete/teams'
  if (state.lastSurface === 'players') return '/explore/players'
  if (state.lastSurface === 'matchup') return '/matchup'
  return '/compete'
}

export function readCompeteResumeState(userId?: string | null): CompeteResumeState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getCompeteResumeStorageKey(userId))
    if (!raw) return null
    const resume = sanitizeCompeteResumeState(JSON.parse(raw))
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export function writeCompeteResumeState(nextState: CompeteResumeState, userId?: string | null) {
  if (typeof window === 'undefined') return null
  try {
    const current = readCompeteResumeState(userId) || {}
    const saved = sanitizeCompeteResumeState({
      ...current,
      ...nextState,
      lastVisitedAt: nextState.lastVisitedAt || new Date().toISOString(),
    })
    window.localStorage.setItem(getCompeteResumeStorageKey(userId), JSON.stringify(saved))
    return saved
  } catch {
    return null
  }
}

export async function loadCompeteResumeStateFromCloud(accessToken: string) {
  if (!accessToken) return null
  try {
    const response = await fetch('/api/compete/resume', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json() as { resume?: unknown }
    const resume = sanitizeCompeteResumeState(payload.resume)
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export async function syncCompeteResumeState(
  nextState: CompeteResumeState,
  userId?: string | null,
  accessToken?: string | null,
) {
  const saved = writeCompeteResumeState(nextState, userId)
  if (!saved || !accessToken) return saved
  try {
    await fetch('/api/compete/resume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resume: saved }),
      keepalive: true,
    })
  } catch {
    // Keep the local resume available while cloud sync recovers.
  }
  return saved
}
