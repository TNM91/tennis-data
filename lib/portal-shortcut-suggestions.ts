import {
  PORTAL_SHORTCUT_IDS,
  type PortalShortcutPreferenceId,
} from './portal-lane-preferences'

export type PortalShortcutUsageSignal = {
  shortcutId: unknown
  usedAt: unknown
}

const PORTAL_SHORTCUT_USAGE_STORAGE_PREFIX = 'tenaceiq.portal-shortcut-usage.v1'
const PORTAL_SHORTCUT_USAGE_LIMIT = 80

export function getPortalShortcutUsageStorageKey(userId?: string | null) {
  return `${PORTAL_SHORTCUT_USAGE_STORAGE_PREFIX}.${userId || 'guest'}`
}

export function rankPortalShortcutSuggestions(
  signals: readonly PortalShortcutUsageSignal[],
  excludedShortcutIds: readonly PortalShortcutPreferenceId[] = [],
  limit = 3,
) {
  const validShortcutIds = new Set<PortalShortcutPreferenceId>(PORTAL_SHORTCUT_IDS)
  const excluded = new Set(excludedShortcutIds)
  const grouped = new Map<PortalShortcutPreferenceId, { count: number; latestUse: number }>()

  for (const signal of signals) {
    if (
      typeof signal.shortcutId !== 'string'
      || !validShortcutIds.has(signal.shortcutId as PortalShortcutPreferenceId)
    ) continue

    const shortcutId = signal.shortcutId as PortalShortcutPreferenceId
    if (excluded.has(shortcutId)) continue

    const usedAt = typeof signal.usedAt === 'string' ? Date.parse(signal.usedAt) : Number.NaN
    const normalizedUse = Number.isFinite(usedAt) ? usedAt : 0
    const current = grouped.get(shortcutId)
    grouped.set(shortcutId, {
      count: (current?.count ?? 0) + 1,
      latestUse: Math.max(current?.latestUse ?? 0, normalizedUse),
    })
  }

  return [...grouped.entries()]
    .sort((left, right) => (
      right[1].latestUse - left[1].latestUse
      || right[1].count - left[1].count
      || PORTAL_SHORTCUT_IDS.indexOf(left[0]) - PORTAL_SHORTCUT_IDS.indexOf(right[0])
    ))
    .slice(0, Math.max(0, limit))
    .map(([shortcutId]) => shortcutId)
}

export function mergePortalShortcutSuggestionCandidates(
  primary: readonly PortalShortcutPreferenceId[],
  fallback: readonly PortalShortcutPreferenceId[],
) {
  return [...new Set([...primary, ...fallback])]
}

export function recordPortalShortcutUse(
  shortcutId: PortalShortcutPreferenceId,
  userId?: string | null,
  usedAt = new Date().toISOString(),
) {
  if (typeof window === 'undefined') return

  try {
    const key = getPortalShortcutUsageStorageKey(userId)
    const current = parsePortalShortcutUsage(window.localStorage.getItem(key))
    const next = [{ shortcutId, usedAt }, ...current].slice(0, PORTAL_SHORTCUT_USAGE_LIMIT)
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Shortcut suggestions are best-effort; navigation must always continue.
  }
}

export function readPortalShortcutSuggestionCandidates(
  userId?: string | null,
  limit = PORTAL_SHORTCUT_IDS.length,
) {
  if (typeof window === 'undefined') return []

  try {
    const accountSignals = parsePortalShortcutUsage(
      window.localStorage.getItem(getPortalShortcutUsageStorageKey(userId)),
    )
    const guestSignals = userId
      ? parsePortalShortcutUsage(window.localStorage.getItem(getPortalShortcutUsageStorageKey()))
      : []
    return rankPortalShortcutSuggestions([...accountSignals, ...guestSignals], [], limit)
  } catch {
    return []
  }
}

function parsePortalShortcutUsage(value: string | null): PortalShortcutUsageSignal[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is PortalShortcutUsageSignal => (
      Boolean(entry)
      && typeof entry === 'object'
      && 'shortcutId' in entry
      && 'usedAt' in entry
    ))
  } catch {
    return []
  }
}
