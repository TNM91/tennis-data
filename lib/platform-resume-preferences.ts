import { notifyPlatformResumeUpdated } from './platform-resume-events'
import type { PlatformResumeCandidate } from './platform-resume'

export const PLATFORM_RESUME_PREFERENCES_STORAGE_KEY = 'tenaceiq_platform_resume_preferences_v1'
export const PLATFORM_RESUME_PENDING_STORAGE_KEY = 'tenaceiq_platform_resume_pending_v1'
export const PLATFORM_RESUME_CLOUD_SEED_STORAGE_KEY = 'tenaceiq_platform_resume_cloud_seed_v1'
export const PLATFORM_RESUME_LATER_MS = 24 * 60 * 60 * 1000

export type PlatformResumeSuppression = {
  fingerprint: string
  mode: 'later' | 'hidden'
  savedAt: string
  until?: string
}

export type PlatformResumeCloudOperation = {
  id: string
  action: 'suppress' | 'remove'
  fingerprint: string
  queuedAt: string
  suppression?: PlatformResumeSuppression
}

export function getPlatformResumePreferencesStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${PLATFORM_RESUME_PREFERENCES_STORAGE_KEY}:${accountId}` : PLATFORM_RESUME_PREFERENCES_STORAGE_KEY
}

export function getPlatformResumePendingStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${PLATFORM_RESUME_PENDING_STORAGE_KEY}:${accountId}` : PLATFORM_RESUME_PENDING_STORAGE_KEY
}

export function getPlatformResumeCloudSeedStorageKey(userId?: string | null) {
  const accountId = (userId || '').trim()
  return accountId ? `${PLATFORM_RESUME_CLOUD_SEED_STORAGE_KEY}:${accountId}` : PLATFORM_RESUME_CLOUD_SEED_STORAGE_KEY
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

export function sanitizePlatformResumeCloudOperations(value: unknown, now = Date.now()): PlatformResumeCloudOperation[] {
  if (!Array.isArray(value)) return []
  const latestByFingerprint = new Map<string, PlatformResumeCloudOperation>()

  for (const entry of value.slice(0, 60)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const input = entry as Record<string, unknown>
    const id = typeof input.id === 'string' ? input.id.trim().slice(0, 160) : ''
    const action = input.action === 'suppress' || input.action === 'remove' ? input.action : null
    const fingerprint = typeof input.fingerprint === 'string' ? input.fingerprint.trim().slice(0, 2400) : ''
    const queuedAt = typeof input.queuedAt === 'string' ? input.queuedAt.trim().slice(0, 80) : ''
    if (!id || !action || !fingerprint || !Number.isFinite(Date.parse(queuedAt))) continue

    const suppression = action === 'suppress'
      ? sanitizePlatformResumeSuppressions([input.suppression], now)[0]
      : undefined
    if (action === 'suppress' && (!suppression || suppression.fingerprint !== fingerprint)) continue

    const operation: PlatformResumeCloudOperation = {
      id,
      action,
      fingerprint,
      queuedAt,
      ...(suppression ? { suppression } : {}),
    }
    const current = latestByFingerprint.get(fingerprint)
    if (!current || Date.parse(operation.queuedAt) >= Date.parse(current.queuedAt)) {
      latestByFingerprint.set(fingerprint, operation)
    }
  }

  return [...latestByFingerprint.values()]
    .sort((left, right) => Date.parse(left.queuedAt) - Date.parse(right.queuedAt))
    .slice(-30)
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

export function readPlatformResumeCloudOperations(userId?: string | null, now = Date.now()) {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(getPlatformResumePendingStorageKey(userId))
    return raw ? sanitizePlatformResumeCloudOperations(JSON.parse(raw), now) : []
  } catch {
    return []
  }
}

function queuePlatformResumeCloudOperation(
  action: PlatformResumeCloudOperation['action'],
  fingerprint: string,
  userId?: string | null,
  suppression?: PlatformResumeSuppression,
) {
  if (typeof window === 'undefined') return
  const queuedAt = new Date().toISOString()
  const id = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const operation: PlatformResumeCloudOperation = {
    id,
    action,
    fingerprint,
    queuedAt,
    ...(suppression ? { suppression } : {}),
  }
  const current = readPlatformResumeCloudOperations(userId)
  const next = [operation, ...current.filter((entry) => entry.fingerprint !== fingerprint)].slice(0, 30)
  try {
    window.localStorage.setItem(getPlatformResumePendingStorageKey(userId), JSON.stringify(next))
  } catch {
    // The current device still keeps its immediate shortcut preference.
  }
}

function clearPlatformResumeCloudOperations(operationIds: string[], userId?: string | null) {
  if (typeof window === 'undefined' || !operationIds.length) return
  const completed = new Set(operationIds)
  const next = readPlatformResumeCloudOperations(userId).filter((entry) => !completed.has(entry.id))
  try {
    window.localStorage.setItem(getPlatformResumePendingStorageKey(userId), JSON.stringify(next))
  } catch {
    // A future sync can safely replay the idempotent operations.
  }
}

function seedExistingPlatformResumeSuppressions(userId?: string | null) {
  if (typeof window === 'undefined') return
  const seedKey = getPlatformResumeCloudSeedStorageKey(userId)
  try {
    if (window.localStorage.getItem(seedKey)) return
    for (const suppression of readPlatformResumeSuppressions(userId)) {
      queuePlatformResumeCloudOperation('suppress', suppression.fingerprint, userId, suppression)
    }
    window.localStorage.setItem(seedKey, new Date().toISOString())
  } catch {
    // Retry the one-time seed when storage becomes available again.
  }
}

export function replacePlatformResumeSuppressions(
  suppressions: PlatformResumeSuppression[],
  userId?: string | null,
  now = Date.now(),
) {
  if (typeof window === 'undefined') return []
  const current = readPlatformResumeSuppressions(userId, now)
  const next = sanitizePlatformResumeSuppressions(suppressions, now)
  try {
    window.localStorage.setItem(getPlatformResumePreferencesStorageKey(userId), JSON.stringify(next))
    notifyPlatformResumeUpdated('preferences')
    return next
  } catch {
    return current
  }
}

export function applyPlatformResumeCloudOperations(
  suppressions: PlatformResumeSuppression[],
  operations: PlatformResumeCloudOperation[],
  now = Date.now(),
) {
  const nextByFingerprint = new Map(
    sanitizePlatformResumeSuppressions(suppressions, now).map((entry) => [entry.fingerprint, entry]),
  )
  for (const operation of sanitizePlatformResumeCloudOperations(operations, now)) {
    if (operation.action === 'remove') nextByFingerprint.delete(operation.fingerprint)
    else if (operation.suppression) nextByFingerprint.set(operation.fingerprint, operation.suppression)
  }
  return [...nextByFingerprint.values()]
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
    .slice(0, 30)
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
    queuePlatformResumeCloudOperation('suppress', fingerprint, userId, nextSuppression)
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
    queuePlatformResumeCloudOperation('remove', fingerprint, userId)
    notifyPlatformResumeUpdated('preferences')
    return next
  } catch {
    return current
  }
}

export async function syncPlatformResumeSuppressionsWithCloud(
  accessToken?: string | null,
  userId?: string | null,
) {
  if (!accessToken || !userId || typeof window === 'undefined') return null
  seedExistingPlatformResumeSuppressions(userId)
  let resolved = readPlatformResumeSuppressions(userId)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const operations = readPlatformResumeCloudOperations(userId)
    try {
      const response = await fetch('/api/resume/preferences', {
        method: operations.length ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(operations.length ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(operations.length ? { body: JSON.stringify({ operations }) } : {}),
        cache: 'no-store',
      })
      if (!response.ok) return null
      const payload = await response.json() as { suppressions?: unknown; cloudAvailable?: boolean }
      if (payload.cloudAvailable === false) return null

      const cloudSuppressions = sanitizePlatformResumeSuppressions(payload.suppressions)
      if (operations.length) clearPlatformResumeCloudOperations(operations.map((entry) => entry.id), userId)
      const remaining = readPlatformResumeCloudOperations(userId)
      resolved = replacePlatformResumeSuppressions(
        applyPlatformResumeCloudOperations(cloudSuppressions, remaining),
        userId,
      )
      if (!remaining.length) return resolved
    } catch {
      return null
    }
  }

  return resolved
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
