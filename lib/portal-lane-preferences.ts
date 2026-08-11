export const PORTAL_LANE_IDS = ['find', 'you', 'compete', 'team', 'coach', 'league', 'club'] as const

export type PortalLanePreferenceId = (typeof PORTAL_LANE_IDS)[number]

export const PORTAL_SHORTCUT_IDS = [
  'lane:find',
  'lane:you',
  'lane:compete',
  'lane:team',
  'lane:coach',
  'lane:league',
  'lane:club',
  'action:mylab',
  'action:tactics',
  'action:level-up',
  'action:matchup',
  'action:availability',
  'action:lineup',
  'action:team-room',
  'action:messages',
] as const

export type PortalShortcutPreferenceId = (typeof PORTAL_SHORTCUT_IDS)[number]

export const DEFAULT_PINNED_PORTAL_SHORTCUTS: PortalShortcutPreferenceId[] = [
  'lane:find',
  'lane:you',
  'lane:compete',
  'lane:team',
]
export const PORTAL_SHORTCUT_PIN_LIMIT = 4

const PORTAL_SHORTCUT_STORAGE_PREFIX = 'tenaceiq.portal-shortcuts.v2'
const LEGACY_PORTAL_LANE_STORAGE_PREFIX = 'tenaceiq.portal-lanes.v1'
const PORTAL_PERSONALIZATION_CUE_PREFIX = 'tenaceiq.portal-shortcuts-cue.v1'

export function getPortalShortcutStorageKey(userId?: string | null) {
  return `${PORTAL_SHORTCUT_STORAGE_PREFIX}.${userId || 'guest'}`
}

export function getPortalPersonalizationCueKey(userId?: string | null) {
  return `${PORTAL_PERSONALIZATION_CUE_PREFIX}.${userId || 'guest'}`
}

export function normalizePinnedPortalShortcuts(value: unknown): PortalShortcutPreferenceId[] {
  if (!Array.isArray(value)) return [...DEFAULT_PINNED_PORTAL_SHORTCUTS]

  const valid = new Set<PortalShortcutPreferenceId>(PORTAL_SHORTCUT_IDS)
  const normalized = value.filter(
    (shortcutId, index, shortcutIds): shortcutId is PortalShortcutPreferenceId =>
      typeof shortcutId === 'string'
      && valid.has(shortcutId as PortalShortcutPreferenceId)
      && shortcutIds.indexOf(shortcutId) === index,
  )

  return normalized.length === PORTAL_SHORTCUT_PIN_LIMIT
    ? normalized.slice(0, PORTAL_SHORTCUT_PIN_LIMIT)
    : [...DEFAULT_PINNED_PORTAL_SHORTCUTS]
}

export function buildPortalLaneOrderFromShortcuts(shortcutIds: readonly PortalShortcutPreferenceId[]) {
  const pinnedLaneIds = normalizePinnedPortalShortcuts(shortcutIds)
    .filter((shortcutId) => shortcutId.startsWith('lane:'))
    .map((shortcutId) => shortcutId.slice('lane:'.length) as PortalLanePreferenceId)

  return [...pinnedLaneIds, ...PORTAL_LANE_IDS.filter((laneId) => !pinnedLaneIds.includes(laneId))]
}

export function readPinnedPortalShortcuts(userId?: string | null) {
  if (typeof window === 'undefined') return [...DEFAULT_PINNED_PORTAL_SHORTCUTS]

  try {
    const accountKey = getPortalShortcutStorageKey(userId)
    const accountValue = window.localStorage.getItem(accountKey)
    if (accountValue) return normalizePinnedPortalShortcuts(JSON.parse(accountValue))

    const migrated = readLegacyPortalLaneShortcuts(userId)
    if (migrated) {
      window.localStorage.setItem(accountKey, JSON.stringify(migrated))
      return migrated
    }

    if (userId) {
      const guestValue = window.localStorage.getItem(getPortalShortcutStorageKey())
      if (guestValue) {
        const guestShortcuts = normalizePinnedPortalShortcuts(JSON.parse(guestValue))
        window.localStorage.setItem(accountKey, JSON.stringify(guestShortcuts))
        return guestShortcuts
      }
    }
  } catch {
    // Personalization is best-effort; navigation must remain available.
  }

  return [...DEFAULT_PINNED_PORTAL_SHORTCUTS]
}

export function writePinnedPortalShortcuts(shortcutIds: readonly PortalShortcutPreferenceId[], userId?: string | null) {
  const normalized = cachePinnedPortalShortcuts(shortcutIds, userId)
  if (typeof window === 'undefined') return normalized

  try {
    window.localStorage.setItem(getPortalPersonalizationCueKey(userId), 'dismissed')
  } catch {
    // Personalization is best-effort; navigation must remain available.
  }

  return normalized
}

export function cachePinnedPortalShortcuts(shortcutIds: readonly PortalShortcutPreferenceId[], userId?: string | null) {
  const normalized = normalizePinnedPortalShortcuts(shortcutIds)
  if (typeof window === 'undefined') return normalized

  try {
    window.localStorage.setItem(getPortalShortcutStorageKey(userId), JSON.stringify(normalized))
  } catch {
    // Cloud restoration is best-effort; navigation must remain available.
  }

  return normalized
}

export function shouldShowPortalPersonalizationCue(userId?: string | null) {
  if (typeof window === 'undefined' || !userId) return false

  try {
    if (window.localStorage.getItem(getPortalPersonalizationCueKey(userId))) return false
    if (window.localStorage.getItem(getLegacyPortalLaneStorageKey(userId))) return false
  } catch {
    return false
  }

  return true
}

export function hasDismissedPortalPersonalizationCue(userId?: string | null) {
  if (typeof window === 'undefined') return false

  try {
    return Boolean(window.localStorage.getItem(getPortalPersonalizationCueKey(userId)))
  } catch {
    return false
  }
}

export function isPinnedPortalShortcutList(value: unknown): value is PortalShortcutPreferenceId[] {
  if (!Array.isArray(value) || value.length !== PORTAL_SHORTCUT_PIN_LIMIT) return false
  const valid = new Set<PortalShortcutPreferenceId>(PORTAL_SHORTCUT_IDS)
  return value.every((shortcutId, index) => (
    typeof shortcutId === 'string'
    && valid.has(shortcutId as PortalShortcutPreferenceId)
    && value.indexOf(shortcutId) === index
  ))
}

export function dismissPortalPersonalizationCue(userId?: string | null) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getPortalPersonalizationCueKey(userId), 'dismissed')
  } catch {
    // A dismissed cue may safely return if storage is unavailable.
  }
}

function readLegacyPortalLaneShortcuts(userId?: string | null): PortalShortcutPreferenceId[] | null {
  const accountValue = window.localStorage.getItem(getLegacyPortalLaneStorageKey(userId))
  if (accountValue) return normalizeLegacyPortalLanes(JSON.parse(accountValue))

  if (userId) {
    const guestValue = window.localStorage.getItem(getLegacyPortalLaneStorageKey())
    if (guestValue) return normalizeLegacyPortalLanes(JSON.parse(guestValue))
  }

  return null
}

function normalizeLegacyPortalLanes(value: unknown): PortalShortcutPreferenceId[] {
  if (!Array.isArray(value)) return [...DEFAULT_PINNED_PORTAL_SHORTCUTS]

  const valid = new Set<PortalLanePreferenceId>(PORTAL_LANE_IDS)
  const laneIds = value.filter(
    (laneId, index, values): laneId is PortalLanePreferenceId =>
      typeof laneId === 'string'
      && valid.has(laneId as PortalLanePreferenceId)
      && values.indexOf(laneId) === index,
  )

  if (laneIds.length !== PORTAL_SHORTCUT_PIN_LIMIT) return [...DEFAULT_PINNED_PORTAL_SHORTCUTS]
  return laneIds.map((laneId) => `lane:${laneId}` as PortalShortcutPreferenceId)
}

function getLegacyPortalLaneStorageKey(userId?: string | null) {
  return `${LEGACY_PORTAL_LANE_STORAGE_PREFIX}.${userId || 'guest'}`
}
