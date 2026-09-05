import type { TeamConnection } from './team-profile-links'
import { notifyTeamConnectionsChanged } from './team-profile-links-events'
import type { TeamInviteOffer, TeamInviteOffers } from './team-invite-offers-core'

export type { TeamInviteOffer, TeamInviteOffers }

export type TeamConnectionsResponse = {
  ok?: boolean
  pending?: TeamConnection[]
  connections?: TeamConnection[]
  connection?: TeamConnection | null
  offers?: TeamInviteOffers
  message?: string
}

export type TeamConnectionsResult = {
  pending: TeamConnection[]
  connections: TeamConnection[]
  offers: TeamInviteOffers
}

const TEAM_CONNECTIONS_CACHE_TTL_MS = 60_000
const TEAM_CONNECTIONS_REQUEST_TIMEOUT_MS = 8_000
const PERSISTED_TEAM_CONNECTIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const TEAM_CONNECTIONS_CACHE_PREFIX = 'tenaceiq-team-connections:v1:'
let teamConnectionsCache: {
  identityKey: string
  expiresAt: number
  includesOffers: boolean
  value?: TeamConnectionsResult
  promise?: Promise<TeamConnectionsResult>
} | null = null
let teamConnectionsRevision = 0
const dirtyTeamConnectionIdentities = new Set<string>()

type PersistedTeamConnections = {
  cachedAt: number
  includesOffers: boolean
  value: TeamConnectionsResult
}

function getTeamConnectionsStorageKey(accessToken: string, userId?: string | null) {
  if (userId?.trim()) return `${TEAM_CONNECTIONS_CACHE_PREFIX}${userId.trim()}`
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return ''
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const subject = JSON.parse(globalThis.atob(normalized))?.sub
    return typeof subject === 'string' && subject ? `${TEAM_CONNECTIONS_CACHE_PREFIX}${subject}` : ''
  } catch {
    return ''
  }
}

function getTeamConnectionsIdentityKey(accessToken: string, userId?: string | null) {
  return getTeamConnectionsStorageKey(accessToken, userId) || accessToken
}

function readPersistedTeamConnections(accessToken: string, includeOffers: boolean, userId?: string | null) {
  if (typeof window === 'undefined') return null
  const key = getTeamConnectionsStorageKey(accessToken, userId)
  if (!key) return null

  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '') as Partial<PersistedTeamConnections>
    if (
      !Number.isFinite(value.cachedAt)
      || !value.value
      || Date.now() - Number(value.cachedAt) > PERSISTED_TEAM_CONNECTIONS_CACHE_TTL_MS
      || (includeOffers && value.includesOffers !== true)
    ) {
      window.localStorage.removeItem(key)
      return null
    }
    return value.value as TeamConnectionsResult
  } catch {
    return null
  }
}

function writePersistedTeamConnections(accessToken: string, includesOffers: boolean, value: TeamConnectionsResult, userId?: string | null) {
  if (typeof window === 'undefined') return
  const key = getTeamConnectionsStorageKey(accessToken, userId)
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), includesOffers, value }))
  } catch {
    // Private browsing and full storage must not prevent teams from loading.
  }
}

async function requestTeamConnections(accessToken: string, includeOffers: boolean, forceRefresh: boolean): Promise<TeamConnectionsResult> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), TEAM_CONNECTIONS_REQUEST_TIMEOUT_MS)

  try {
    const query = new URLSearchParams()
    if (includeOffers) query.set('includeOffers', '1')
    if (forceRefresh) query.set('refresh', '1')
    const response = await fetch(`/api/team-connections${query.size ? `?${query.toString()}` : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    })
    const json = (await response.json()) as TeamConnectionsResponse
    if (!response.ok || !json.ok) throw new Error(json.message || 'Team connections could not be loaded.')
    return {
      pending: json.pending || [],
      connections: json.connections || [],
      offers: json.offers || {
        captain: { available: false, label: '' },
        player: { available: false, label: '' },
      },
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Team connections are taking longer than expected. Please try again.')
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export function getCachedTeamConnections(accessToken: string, options: { includeOffers?: boolean; userId?: string | null } = {}) {
  const identityKey = getTeamConnectionsIdentityKey(accessToken, options.userId)
  if (identityKey && teamConnectionsCache?.identityKey === identityKey && (!options.includeOffers || teamConnectionsCache.includesOffers)) {
    return teamConnectionsCache.value || null
  }
  return readPersistedTeamConnections(accessToken, options.includeOffers === true, options.userId)
}

export async function fetchTeamConnections(accessToken: string, options: { force?: boolean; includeOffers?: boolean; userId?: string | null } = {}): Promise<TeamConnectionsResult> {
  const now = Date.now()
  const includeOffers = options.includeOffers === true
  const identityKey = getTeamConnectionsIdentityKey(accessToken, options.userId)
  if (
    !options.force
    && teamConnectionsCache?.identityKey === identityKey
    && teamConnectionsCache.expiresAt > now
    && (!includeOffers || teamConnectionsCache.includesOffers)
  ) {
    if (teamConnectionsCache.value) return teamConnectionsCache.value
    if (teamConnectionsCache.promise) {
      const revision = teamConnectionsRevision
      const value = await teamConnectionsCache.promise
      return revision === teamConnectionsRevision ? value : fetchTeamConnections(accessToken, options)
    }
  }

  const revision = teamConnectionsRevision
  const promise = requestTeamConnections(accessToken, includeOffers, options.force === true || dirtyTeamConnectionIdentities.has(identityKey))
  teamConnectionsCache = {
    identityKey,
    expiresAt: now + TEAM_CONNECTIONS_CACHE_TTL_MS,
    includesOffers: includeOffers,
    promise,
  }

  try {
    const value = await promise
    // A read started before a save must not restore the old invitation in
    // either the caller or the persistent cache when it completes late.
    if (revision !== teamConnectionsRevision) {
      return fetchTeamConnections(accessToken, options)
    }
    if (teamConnectionsCache?.promise === promise) {
      teamConnectionsCache = {
        identityKey,
        expiresAt: Date.now() + TEAM_CONNECTIONS_CACHE_TTL_MS,
        includesOffers: includeOffers,
        value,
      }
      dirtyTeamConnectionIdentities.delete(identityKey)
      writePersistedTeamConnections(accessToken, includeOffers, value, options.userId)
    }
    return value
  } catch (error) {
    if (teamConnectionsCache?.promise === promise) teamConnectionsCache = null
    throw error
  }
}

export function preloadTeamConnections(accessToken: string, options: { userId?: string | null } = {}) {
  if (!accessToken) return
  void fetchTeamConnections(accessToken, options).catch(() => undefined)
}

function invalidateTeamConnectionsCache(accessToken: string) {
  teamConnectionsRevision += 1
  dirtyTeamConnectionIdentities.add(getTeamConnectionsIdentityKey(accessToken))
  teamConnectionsCache = null
  if (typeof window === 'undefined') return
  const key = getTeamConnectionsStorageKey(accessToken)
  if (!key) return
  try { window.localStorage.removeItem(key) } catch { /* In-memory invalidation still applies. */ }
}

export async function updateTeamConnection(input: {
  accessToken: string
  connectionId: string
  action: 'accept' | 'decline' | 'unlink' | 'relink' | 'restore_roles' | 'set_default'
}) {
  const response = await fetch('/api/team-connections', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: input.action, connectionId: input.connectionId }),
  })
  const json = (await response.json()) as TeamConnectionsResponse
  if (!response.ok || !json.ok) throw new Error(json.message || 'Team connection could not be updated.')
  invalidateTeamConnectionsCache(input.accessToken)
  notifyTeamConnectionsChanged()
  return json.connection || null
}

export async function acceptCaptainImportConnection(input: {
  accessToken: string
  batchId: string
}) {
  const response = await fetch('/api/team-connections', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'accept_import', importBatchId: input.batchId }),
  })
  const json = (await response.json()) as TeamConnectionsResponse
  if (!response.ok || !json.ok) throw new Error(json.message || 'Imported team could not be connected.')
  invalidateTeamConnectionsCache(input.accessToken)
  notifyTeamConnectionsChanged()
  return json.connection || null
}
