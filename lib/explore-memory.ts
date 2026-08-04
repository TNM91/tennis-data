import { notifyPlatformResumeUpdated } from './platform-resume-events'

export const EXPLORE_RESUME_STORAGE_KEY = 'tenaceiq_explore_resume_v1'

export type ExploreResumeSurface =
  | 'explore'
  | 'search'
  | 'players'
  | 'player'
  | 'teams'
  | 'team'
  | 'leagues'
  | 'league'
  | 'rankings'

export type ExploreResumeState = {
  lastSurface?: ExploreResumeSurface
  lastSurfaceLabel?: string
  lastHref?: string
  lastVisitedAt?: string
  contextLabel?: string
}

const SURFACES = new Set<ExploreResumeSurface>([
  'explore',
  'search',
  'players',
  'player',
  'teams',
  'team',
  'leagues',
  'league',
  'rankings',
])

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function getExploreResumeStorageKey(userId?: string | null) {
  const accountId = cleanText(userId, 180)
  return accountId ? `${EXPLORE_RESUME_STORAGE_KEY}:${accountId}` : EXPLORE_RESUME_STORAGE_KEY
}

export function isSafeExploreResumeHref(value: unknown): value is string {
  const href = cleanText(value, 1800)
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false
  try {
    const parsed = new URL(href, 'https://www.tenaceiq.com')
    return parsed.origin === 'https://www.tenaceiq.com'
  } catch {
    return false
  }
}

export function sanitizeExploreResumeState(value: unknown): ExploreResumeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const lastSurface = cleanText(input.lastSurface) as ExploreResumeSurface
  const lastHref = isSafeExploreResumeHref(input.lastHref) ? cleanText(input.lastHref, 1800) : ''

  return {
    ...(SURFACES.has(lastSurface) ? { lastSurface } : {}),
    ...(cleanText(input.lastSurfaceLabel, 120) ? { lastSurfaceLabel: cleanText(input.lastSurfaceLabel, 120) } : {}),
    ...(lastHref ? { lastHref } : {}),
    ...(cleanText(input.lastVisitedAt, 80) ? { lastVisitedAt: cleanText(input.lastVisitedAt, 80) } : {}),
    ...(cleanText(input.contextLabel, 300) ? { contextLabel: cleanText(input.contextLabel, 300) } : {}),
  }
}

function resumeTimestamp(state: ExploreResumeState | null | undefined) {
  const timestamp = Date.parse(state?.lastVisitedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function chooseLatestExploreResumeState(
  localState: ExploreResumeState | null,
  cloudState: ExploreResumeState | null,
) {
  if (!localState) return cloudState
  if (!cloudState) return localState
  return resumeTimestamp(cloudState) > resumeTimestamp(localState) ? cloudState : localState
}

export function getExploreResumeHref(state: ExploreResumeState | null | undefined) {
  if (!state) return ''
  if (isSafeExploreResumeHref(state.lastHref)) return state.lastHref
  if (state.lastSurface === 'search') return '/explore/search'
  if (state.lastSurface === 'player' || state.lastSurface === 'players') return '/explore/players'
  if (state.lastSurface === 'team' || state.lastSurface === 'teams') return '/explore/teams'
  if (state.lastSurface === 'league' || state.lastSurface === 'leagues') return '/explore/leagues'
  if (state.lastSurface === 'rankings') return '/explore/rankings'
  return '/explore'
}

export function readExploreResumeState(userId?: string | null): ExploreResumeState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getExploreResumeStorageKey(userId))
    if (!raw) return null
    const resume = sanitizeExploreResumeState(JSON.parse(raw))
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export function writeExploreResumeState(nextState: ExploreResumeState, userId?: string | null) {
  if (typeof window === 'undefined') return null
  try {
    const current = readExploreResumeState(userId) || {}
    const saved = sanitizeExploreResumeState({
      ...current,
      ...nextState,
      lastVisitedAt: nextState.lastVisitedAt || new Date().toISOString(),
    })
    window.localStorage.setItem(getExploreResumeStorageKey(userId), JSON.stringify(saved))
    notifyPlatformResumeUpdated('explore')
    return saved
  } catch {
    return null
  }
}

export async function loadExploreResumeStateFromCloud(accessToken: string) {
  if (!accessToken) return null
  try {
    const response = await fetch('/api/explore/resume', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json() as { resume?: unknown }
    const resume = sanitizeExploreResumeState(payload.resume)
    return Object.keys(resume).length ? resume : null
  } catch {
    return null
  }
}

export async function syncExploreResumeState(
  nextState: ExploreResumeState,
  userId?: string | null,
  accessToken?: string | null,
) {
  const saved = writeExploreResumeState(nextState, userId)
  if (!saved || !accessToken) return saved
  try {
    await fetch('/api/explore/resume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resume: saved }),
      keepalive: true,
    })
  } catch {
    // Keep device continuity while cloud sync recovers.
  }
  return saved
}
