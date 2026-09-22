export type PrivateClientSnapshot<T> = {
  value: T
  cachedAt: number
  ageMs: number
  stale: boolean
}

type StoredPrivateClientSnapshot<T> = {
  version: 1
  cachedAt: number
  value: T
}

const STORAGE_PREFIX = 'tenaceiq:private-snapshot:v1:'

function getStorageKey(namespace: string, userId: string, scope = '') {
  const normalizedNamespace = namespace.trim().replace(/[^a-z0-9:_-]+/gi, '-')
  const normalizedScope = scope.trim().replace(/[^a-z0-9:_-]+/gi, '-')
  if (!normalizedNamespace || !userId.trim()) return ''
  return `${STORAGE_PREFIX}${normalizedNamespace}:${userId.trim()}${normalizedScope ? `:${normalizedScope}` : ''}`
}

/**
 * Stores a last known good response only on the signed-in user's device. It is
 * a resilience layer for temporary database or network delays, never an
 * authorization source, and all server mutations still revalidate normally.
 */
export function readPrivateClientSnapshot<T>(input: {
  namespace: string
  userId: string | null | undefined
  scope?: string
  maxAgeMs: number
  allowStale?: boolean
}): PrivateClientSnapshot<T> | null {
  if (typeof window === 'undefined' || !input.userId) return null
  const key = getStorageKey(input.namespace, input.userId, input.scope)
  if (!key) return null

  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '') as Partial<StoredPrivateClientSnapshot<T>>
    if (stored.version !== 1 || !Number.isFinite(stored.cachedAt) || stored.value === undefined) {
      window.localStorage.removeItem(key)
      return null
    }

    const ageMs = Math.max(0, Date.now() - Number(stored.cachedAt))
    const stale = ageMs > input.maxAgeMs
    if (stale && !input.allowStale) return null

    return {
      value: stored.value as T,
      cachedAt: Number(stored.cachedAt),
      ageMs,
      stale,
    }
  } catch {
    return null
  }
}

export function writePrivateClientSnapshot<T>(input: {
  namespace: string
  userId: string | null | undefined
  scope?: string
  value: T
}) {
  if (typeof window === 'undefined' || !input.userId) return
  const key = getStorageKey(input.namespace, input.userId, input.scope)
  if (!key) return

  try {
    const stored: StoredPrivateClientSnapshot<T> = {
      version: 1,
      cachedAt: Date.now(),
      value: input.value,
    }
    window.localStorage.setItem(key, JSON.stringify(stored))
  } catch {
    // Private browsing and full local storage must not prevent a live request.
  }
}
