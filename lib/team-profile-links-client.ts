import type { TeamConnection } from './team-profile-links'
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

export async function fetchTeamConnections(accessToken: string) {
  const response = await fetch('/api/team-connections', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
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
}

export async function updateTeamConnection(input: {
  accessToken: string
  connectionId: string
  action: 'accept' | 'decline' | 'unlink' | 'relink'
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
  return json.connection || null
}
