import { notifyPlatformResumeUpdated } from './platform-resume-events'
import type { PlatformResumeCandidate } from './platform-resume'

export const PLATFORM_RESUME_PREFERENCES_STORAGE_KEY = 'tenaceiq_platform_resume_preferences_v1'
export const PLATFORM_RESUME_LATER_MS = 24 * 60 * 60 * 1000

export type PlatformResumeSuppression = {
  fingerprint: string
  mode: 'later' | 'hidden'
  savedAt: string
  until?: string
}

export function getPlatformResumePreferencesStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${PLATFORM_RESUME_PREFERENCES_STORAGE_KEY}:${accountId}` : PLATFORM_RESUME_PREFERENCES_STORAGE_KEY
}

export function getPlatformResumeFingerprint(candidate: PlatformResumeCandidate) {
  return candidate.status === 'unfinished'
    ? [candidate.id, candidate.status, candidate.actionLabel, candidate.href, candidate.reason].join('|')
    : [candidate.id, candidate.status, candidate.href, candidate.visitedAt].join('|')
}

export function sanitizePlatformResumeSuppressions(value: unknown, now = Date.now()): PlatformResumeSuppression[] {
  if (!Array.isArray(value)) return []

  return value.flatMap<PlatformResumeSuppression>((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const input = entry as Record<string, unknown>
    const fingerprint = typeof input.fingerprint === 'string' ? input.fingerprint.trim().slice(0, 2400) : ''
    const mode = input.mode === 'later' || input.mode === 'hidden' ? input.mode : null
    const savedAt = typeof input.savedAt === 'string' ? input.savedAt.trim().slice(0, 80) : ''
    const until = typeof input.until === 'string' ? input.until.trim().slice(0, 80) : ''
    if (!fingerprint || !mode || !Number.isFinite(Date.parse(savedAt))) return []
    if (mode === 'later' && (!Number.isFinite(Date.parse(until)) || Date.parse(until) <= now)) return []

    return [{ fingerprint, mode, savedAt, ...(mode === 'later' ? { until } : {}) }]
  }).slice(0, 30)
}

export function readPlatformResumeSuppressions(userId?: string | null, now = Date.now()) {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(getPlatformResumePreferencesStorageKey(userId))
    return raw ? sanitizePlatformResumeSuppressions(JSON.parse(raw), now) : []
  } catch {
    return []
  }
}

export function suppressPlatformResumeCandidate(
  candidate: PlatformResumeCandidate,
  mode: PlatformResumeSuppression['mode'],
  userId?: string | null,
  now = Date.now(),
) {
  if (typeof window === 'undefined') return []
  const fingerprint = getPlatformResumeFingerprint(candidate)
  const nextSuppression: PlatformResumeSuppression = {
    fingerprint,
    mode,
    savedAt: new Date(now).toISOString(),
    ...(mode === 'later' ? { until: new Date(now + PLATFORM_RESUME_LATER_MS).toISOString() } : {}),
  }
  const current = readPlatformResumeSuppressions(userId, now)
  const next = [nextSuppression, ...current.filter((entry) => entry.fingerprint !== fingerprint)].slice(0, 30)
  try {
    window.localStorage.setItem(getPlatformResumePreferencesStorageKey(userId), JSON.stringify(next))
    notifyPlatformResumeUpdated('preferences')
    return next
  } catch {
    return current
  }
}

export function removePlatformResumeSuppression(fingerprint: string, userId?: string | null) {
  if (typeof window === 'undefined') return []
  const current = readPlatformResumeSuppressions(userId)
  const next = current.filter((entry) => entry.fingerprint !== fingerprint)
  try {
    window.localStorage.setItem(getPlatformResumePreferencesStorageKey(userId), JSON.stringify(next))
    notifyPlatformResumeUpdated('preferences')
    return next
  } catch {
    return current
  }
}

export function filterPlatformResumeCandidates(
  candidates: PlatformResumeCandidate[],
  suppressions: PlatformResumeSuppression[],
  now = Date.now(),
) {
  const suppressed = new Set(
    suppressions
      .filter((entry) => entry.mode === 'hidden' || Date.parse(entry.until || '') > now)
      .map((entry) => entry.fingerprint),
  )
  return candidates.filter((candidate) => !suppressed.has(getPlatformResumeFingerprint(candidate)))
}
