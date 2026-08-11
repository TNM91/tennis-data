import {
  PORTAL_SHORTCUT_IDS,
  type PortalShortcutPreferenceId,
} from './portal-lane-preferences'

export type PortalShortcutUsageSignal = {
  shortcutId: unknown
  usedAt: unknown
  source?: unknown
}

export type PortalShortcutPinRecommendation = {
  shortcutId: PortalShortcutPreferenceId
  replaceShortcutId: PortalShortcutPreferenceId
}

const PORTAL_SHORTCUT_USAGE_STORAGE_PREFIX = 'tenaceiq.portal-shortcut-usage.v1'
const PORTAL_SHORTCUT_RECOMMENDATION_DISMISSAL_PREFIX = 'tenaceiq.portal-shortcut-recommendation.v1'
const PORTAL_SHORTCUT_USAGE_LIMIT = 80
const PORTAL_SHORTCUT_RECOMMENDATION_THRESHOLD = 3
const PORTAL_SHORTCUT_RECOMMENDATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const PORTAL_SHORTCUT_RECOMMENDATION_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export function getPortalShortcutUsageStorageKey(userId?: string | null) {
  return `${PORTAL_SHORTCUT_USAGE_STORAGE_PREFIX}.${userId || 'guest'}`
}

export function getPortalShortcutRecommendationDismissalKey(userId?: string | null) {
  return `${PORTAL_SHORTCUT_RECOMMENDATION_DISMISSAL_PREFIX}.${userId || 'guest'}`
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
  source: 'pinned' | 'all_tools' = 'pinned',
) {
  if (typeof window === 'undefined') return

  try {
    const key = getPortalShortcutUsageStorageKey(userId)
    const current = parsePortalShortcutUsage(window.localStorage.getItem(key))
    const next = [{ shortcutId, usedAt, source }, ...current].slice(0, PORTAL_SHORTCUT_USAGE_LIMIT)
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Shortcut suggestions are best-effort; navigation must always continue.
  }
}

export function buildPortalShortcutPinRecommendation(
  signals: readonly PortalShortcutUsageSignal[],
  pinnedShortcutIds: readonly PortalShortcutPreferenceId[],
  dismissedAtByShortcut: Readonly<Partial<Record<PortalShortcutPreferenceId, number>>> = {},
  now = Date.now(),
): PortalShortcutPinRecommendation | null {
  const pinned = new Set(pinnedShortcutIds)
  const recentAllToolsSignals = signals.filter((signal) => {
    const usedAt = typeof signal.usedAt === 'string' ? Date.parse(signal.usedAt) : Number.NaN
    return signal.source === 'all_tools'
      && Number.isFinite(usedAt)
      && now - usedAt <= PORTAL_SHORTCUT_RECOMMENDATION_WINDOW_MS
  })
  const counts = new Map<PortalShortcutPreferenceId, number>()

  for (const signal of recentAllToolsSignals) {
    if (typeof signal.shortcutId !== 'string') continue
    const shortcutId = signal.shortcutId as PortalShortcutPreferenceId
    if (!(PORTAL_SHORTCUT_IDS as readonly string[]).includes(shortcutId) || pinned.has(shortcutId)) continue
    counts.set(shortcutId, (counts.get(shortcutId) ?? 0) + 1)
  }

  const eligibleSignals = recentAllToolsSignals.filter((signal) => {
    if (typeof signal.shortcutId !== 'string') return false
    const shortcutId = signal.shortcutId as PortalShortcutPreferenceId
    const dismissedAt = dismissedAtByShortcut[shortcutId] ?? 0
    return (counts.get(shortcutId) ?? 0) >= PORTAL_SHORTCUT_RECOMMENDATION_THRESHOLD
      && now - dismissedAt >= PORTAL_SHORTCUT_RECOMMENDATION_COOLDOWN_MS
  })
  const [shortcutId] = rankPortalShortcutSuggestions(eligibleSignals, pinnedShortcutIds, 1)
  if (!shortcutId) return null

  const replaceShortcutId = findLeastUsedPinnedShortcut(signals, pinnedShortcutIds)
  return replaceShortcutId ? { shortcutId, replaceShortcutId } : null
}

export function readPortalShortcutPinRecommendation(
  pinnedShortcutIds: readonly PortalShortcutPreferenceId[],
  userId?: string | null,
  now = Date.now(),
) {
  if (typeof window === 'undefined') return null

  try {
    const signals = readStoredUsageSignals(userId)
    const dismissed = parseRecommendationDismissals(
      window.localStorage.getItem(getPortalShortcutRecommendationDismissalKey(userId)),
    )
    return buildPortalShortcutPinRecommendation(signals, pinnedShortcutIds, dismissed, now)
  } catch {
    return null
  }
}

export function dismissPortalShortcutPinRecommendation(
  shortcutId: PortalShortcutPreferenceId,
  userId?: string | null,
  dismissedAt = Date.now(),
) {
  if (typeof window === 'undefined') return

  try {
    const key = getPortalShortcutRecommendationDismissalKey(userId)
    const current = parseRecommendationDismissals(window.localStorage.getItem(key))
    window.localStorage.setItem(key, JSON.stringify({ ...current, [shortcutId]: dismissedAt }))
  } catch {
    // Recommendation dismissal is best-effort and must not interrupt navigation.
  }
}

export function readPortalShortcutSuggestionCandidates(
  userId?: string | null,
  limit = PORTAL_SHORTCUT_IDS.length,
) {
  if (typeof window === 'undefined') return []

  try {
    return rankPortalShortcutSuggestions(readStoredUsageSignals(userId), [], limit)
  } catch {
    return []
  }
}

function readStoredUsageSignals(userId?: string | null) {
  const accountSignals = parsePortalShortcutUsage(
    window.localStorage.getItem(getPortalShortcutUsageStorageKey(userId)),
  )
  const guestSignals = userId
    ? parsePortalShortcutUsage(window.localStorage.getItem(getPortalShortcutUsageStorageKey()))
    : []
  return [...accountSignals, ...guestSignals]
}

function findLeastUsedPinnedShortcut(
  signals: readonly PortalShortcutUsageSignal[],
  pinnedShortcutIds: readonly PortalShortcutPreferenceId[],
) {
  const usage = new Map<PortalShortcutPreferenceId, { count: number; latestUse: number }>()
  for (const signal of signals) {
    if (typeof signal.shortcutId !== 'string') continue
    const shortcutId = signal.shortcutId as PortalShortcutPreferenceId
    if (!pinnedShortcutIds.includes(shortcutId)) continue
    const usedAt = typeof signal.usedAt === 'string' ? Date.parse(signal.usedAt) : Number.NaN
    const current = usage.get(shortcutId)
    usage.set(shortcutId, {
      count: (current?.count ?? 0) + 1,
      latestUse: Math.max(current?.latestUse ?? 0, Number.isFinite(usedAt) ? usedAt : 0),
    })
  }

  return [...pinnedShortcutIds]
    .sort((left, right) => {
      const leftUsage = usage.get(left) ?? { count: 0, latestUse: 0 }
      const rightUsage = usage.get(right) ?? { count: 0, latestUse: 0 }
      return leftUsage.latestUse - rightUsage.latestUse
        || leftUsage.count - rightUsage.count
        || pinnedShortcutIds.indexOf(right) - pinnedShortcutIds.indexOf(left)
    })[0]
}

function parseRecommendationDismissals(value: string | null) {
  if (!value) return {} as Partial<Record<PortalShortcutPreferenceId, number>>

  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(([shortcutId, dismissedAt]) => (
        (PORTAL_SHORTCUT_IDS as readonly string[]).includes(shortcutId)
        && typeof dismissedAt === 'number'
        && Number.isFinite(dismissedAt)
      )),
    ) as Partial<Record<PortalShortcutPreferenceId, number>>
  } catch {
    return {}
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
