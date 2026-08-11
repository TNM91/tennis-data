export const PORTAL_LANE_IDS = ['find', 'you', 'compete', 'team', 'coach', 'league', 'club'] as const

export type PortalLanePreferenceId = (typeof PORTAL_LANE_IDS)[number]

export const DEFAULT_PINNED_PORTAL_LANES: PortalLanePreferenceId[] = ['find', 'you', 'compete', 'team']
export const PORTAL_LANE_PIN_LIMIT = 4

const PORTAL_LANE_STORAGE_PREFIX = 'tenaceiq.portal-lanes.v1'

export function getPortalLaneStorageKey(userId?: string | null) {
  return `${PORTAL_LANE_STORAGE_PREFIX}.${userId || 'guest'}`
}

export function normalizePinnedPortalLanes(value: unknown): PortalLanePreferenceId[] {
  if (!Array.isArray(value)) return [...DEFAULT_PINNED_PORTAL_LANES]

  const valid = new Set<PortalLanePreferenceId>(PORTAL_LANE_IDS)
  const normalized = value.filter(
    (laneId, index, lanes): laneId is PortalLanePreferenceId =>
      typeof laneId === 'string'
      && valid.has(laneId as PortalLanePreferenceId)
      && lanes.indexOf(laneId) === index,
  )

  return normalized.length === PORTAL_LANE_PIN_LIMIT
    ? normalized.slice(0, PORTAL_LANE_PIN_LIMIT)
    : [...DEFAULT_PINNED_PORTAL_LANES]
}

export function buildPortalLaneOrder(pinnedLaneIds: readonly PortalLanePreferenceId[]) {
  const pinned = normalizePinnedPortalLanes(pinnedLaneIds)
  return [...pinned, ...PORTAL_LANE_IDS.filter((laneId) => !pinned.includes(laneId))]
}

export function readPinnedPortalLanes(userId?: string | null) {
  if (typeof window === 'undefined') return [...DEFAULT_PINNED_PORTAL_LANES]

  try {
    const accountKey = getPortalLaneStorageKey(userId)
    const accountValue = window.localStorage.getItem(accountKey)
    if (accountValue) return normalizePinnedPortalLanes(JSON.parse(accountValue))

    if (userId) {
      const guestValue = window.localStorage.getItem(getPortalLaneStorageKey())
      if (guestValue) {
        const migrated = normalizePinnedPortalLanes(JSON.parse(guestValue))
        window.localStorage.setItem(accountKey, JSON.stringify(migrated))
        return migrated
      }
    }
  } catch {
    // Personalization is best-effort; navigation must remain available.
  }

  return [...DEFAULT_PINNED_PORTAL_LANES]
}

export function writePinnedPortalLanes(laneIds: readonly PortalLanePreferenceId[], userId?: string | null) {
  const normalized = normalizePinnedPortalLanes(laneIds)
  if (typeof window === 'undefined') return normalized

  try {
    window.localStorage.setItem(getPortalLaneStorageKey(userId), JSON.stringify(normalized))
  } catch {
    // Personalization is best-effort; navigation must remain available.
  }

  return normalized
}
