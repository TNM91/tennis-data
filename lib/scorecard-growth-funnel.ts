import { isAccessGrantCurrent } from '@/lib/access-model-core'
import type { GrowthEventRow } from '@/lib/admin-growth-funnel'
import { SCORECARD_SIGNUP_SOURCE } from '@/lib/scorecard-signup'

export type ScorecardSignupIdentity = {
  id: string
  emailConfirmed: boolean
  claimPlayerId?: string | null
}

export type ScorecardSignupProfile = {
  id: string
  linked_player_id: string | null
  stripe_subscription_id: string | null
  player_plus_subscription_active: boolean | null
  player_plus_subscription_status: string | null
  player_plus_access_expires_at: string | null
}

export type ScorecardSignupFunnel = {
  signupRequests: number
  playerClaimStarts: number
  playerClaimCompletions: number
  confirmedAccounts: number
  connectedPlayers: number
  paidPlayerMemberships: number
}

export function getScorecardSignupIds(events: GrowthEventRow[]) {
  return [...new Set(events
    .filter((event) => event.event_name === 'signup_confirmation_sent'
      && event.metadata?.acquisitionSource === SCORECARD_SIGNUP_SOURCE)
    .map((event) => event.user_id)
    .filter((id): id is string => Boolean(id)))]
}

export function buildScorecardSignupFunnel(
  signupIds: string[],
  identities: ScorecardSignupIdentity[],
  profiles: ScorecardSignupProfile[],
  now = Date.now(),
): ScorecardSignupFunnel {
  const confirmed = new Set(identities.filter((identity) => identity.emailConfirmed).map((identity) => identity.id))
  const identityById = new Map(identities.map((identity) => [identity.id, identity]))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const connected = signupIds.filter((id) => confirmed.has(id) && Boolean(profileById.get(id)?.linked_player_id))
  const playerClaimStarts = signupIds.filter((id) => Boolean(identityById.get(id)?.claimPlayerId))
  const playerClaimCompletions = playerClaimStarts.filter((id) => {
    const claimPlayerId = identityById.get(id)?.claimPlayerId
    return confirmed.has(id) && Boolean(claimPlayerId) && profileById.get(id)?.linked_player_id === claimPlayerId
  })

  return {
    signupRequests: signupIds.length,
    playerClaimStarts: playerClaimStarts.length,
    playerClaimCompletions: playerClaimCompletions.length,
    confirmedAccounts: signupIds.filter((id) => confirmed.has(id)).length,
    connectedPlayers: connected.length,
    paidPlayerMemberships: connected.filter((id) => {
      const profile = profileById.get(id)!
      return Boolean(profile.stripe_subscription_id)
        && profile.player_plus_subscription_active === true
        && profile.player_plus_subscription_status === 'active'
        && isAccessGrantCurrent(profile.player_plus_access_expires_at, now)
    }).length,
  }
}
