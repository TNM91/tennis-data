import type { GrowthEventRow } from '@/lib/admin-growth-funnel'
import { PLAYER_PROFILE_SHARE_SOURCE, PLAYER_PROFILE_SOURCE, getPlayerProfileAcquisitionSource } from '@/lib/player-profile-acquisition'
import { buildScorecardSignupFunnel, type ScorecardSignupIdentity, type ScorecardSignupProfile } from '@/lib/scorecard-growth-funnel'

export function getPlayerProfileSignupIds(events: GrowthEventRow[]) {
  const ids = new Set<string>()
  for (const event of events) {
    if (event.event_name !== 'signup_confirmation_sent' || !event.user_id || (event.plan_id !== null && event.plan_id !== 'free')) continue
    if (getPlayerProfileAcquisitionSource(event.metadata?.acquisitionSource, 'free', '/profile#profile-identity')) ids.add(event.user_id)
  }
  return [...ids]
}

export type PlayerProfileAcquisitionStage = {
  signupRequests: number
  confirmedAccounts: number
  connectedPlayers: number
  paidPlayerMemberships: number
}

export type PlayerProfileAcquisitionFunnel = {
  publicProfile: PlayerProfileAcquisitionStage
  sharedProfile: PlayerProfileAcquisitionStage
  total: PlayerProfileAcquisitionStage
}

export function buildPlayerProfileAcquisitionFunnel(
  events: GrowthEventRow[],
  identities: ScorecardSignupIdentity[],
  profiles: ScorecardSignupProfile[],
  now = Date.now(),
): PlayerProfileAcquisitionFunnel {
  const idsBySource = {
    [PLAYER_PROFILE_SOURCE]: new Set<string>(),
    [PLAYER_PROFILE_SHARE_SOURCE]: new Set<string>(),
  }
  for (const event of events) {
    if (event.event_name !== 'signup_confirmation_sent' || !event.user_id || (event.plan_id !== null && event.plan_id !== 'free')) continue
    const source = getPlayerProfileAcquisitionSource(event.metadata?.acquisitionSource, 'free', '/profile#profile-identity')
    if (source) idsBySource[source].add(event.user_id)
  }

  const stage = (ids: string[]): PlayerProfileAcquisitionStage => {
    const result = buildScorecardSignupFunnel(ids, identities, profiles, now)
    return {
      signupRequests: result.signupRequests,
      confirmedAccounts: result.confirmedAccounts,
      connectedPlayers: result.connectedPlayers,
      paidPlayerMemberships: result.paidPlayerMemberships,
    }
  }
  const publicIds = [...idsBySource[PLAYER_PROFILE_SOURCE]]
  const sharedIds = [...idsBySource[PLAYER_PROFILE_SHARE_SOURCE]]
  return {
    publicProfile: stage(publicIds),
    sharedProfile: stage(sharedIds),
    total: stage([...new Set([...publicIds, ...sharedIds])]),
  }
}
