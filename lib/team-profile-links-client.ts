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
let teamConnectionsCache: {
  accessToken: string
  expiresAt: number
  includesOffers: boolean
  value?: TeamConnectionsResult
  promise?: Promise<TeamConnectionsResult>
} | null = null

async function requestTeamConnections(accessToken: string, includeOffers: boolean): Promise<TeamConnectionsResult> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), TEAM_CONNECTIONS_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(includeOffers ? '/api/team-connections?includeOffers=1' : '/api/team-connections', {
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

export function getCachedTeamConnections(accessToken: string, options: { includeOffers?: boolean } = {}) {
  if (
    !accessToken
    || teamConnectionsCache?.accessToken !== accessToken
    || (options.includeOffers === true && teamConnectionsCache.includesOffers !== true)
  ) return null
  return teamConnectionsCache.value || null
}

export async function fetchTeamConnections(accessToken: string, options: { force?: boolean; includeOffers?: boolean } = {}) {
  const now = Date.now()
  const includeOffers = options.includeOffers === true
  if (
    !options.force
    && teamConnectionsCache?.accessToken === accessToken
    && teamConnectionsCache.expiresAt > now
    && (!includeOffers || teamConnectionsCache.includesOffers)
  ) {
    if (teamConnectionsCache.value) return teamConnectionsCache.value
    if (teamConnectionsCache.promise) return teamConnectionsCache.promise
  }

  const promise = requestTeamConnections(accessToken, includeOffers)
  teamConnectionsCache = {
    accessToken,
    expiresAt: now + TEAM_CONNECTIONS_CACHE_TTL_MS,
    includesOffers: includeOffers,
    promise,
  }

  try {
    const value = await promise
    teamConnectionsCache = {
      accessToken,
      expiresAt: Date.now() + TEAM_CONNECTIONS_CACHE_TTL_MS,
      includesOffers: includeOffers,
      value,
    }
    return value
  } catch (error) {
    if (teamConnectionsCache?.promise === promise) teamConnectionsCache = null
    throw error
  }
}

export function preloadTeamConnections(accessToken: string) {
  if (!accessToken) return
  void fetchTeamConnections(accessToken).catch(() => undefined)
}

function invalidateTeamConnectionsCache() {
  teamConnectionsCache = null
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
  invalidateTeamConnectionsCache()
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
  invalidateTeamConnectionsCache()
  notifyTeamConnectionsChanged()
  return json.connection || null
}
