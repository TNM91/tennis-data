export const PLAYER_PROFILE_SOURCE = 'player_profile'
export const PLAYER_PROFILE_SHARE_SOURCE = 'player_profile_share'
export type PlayerProfileSource = typeof PLAYER_PROFILE_SOURCE | typeof PLAYER_PROFILE_SHARE_SOURCE

export function getPlayerProfileAcquisitionSource(value: unknown, planId: string, nextHref: string): PlayerProfileSource | null {
  if (planId !== 'free' || nextHref !== '/profile#profile-identity') return null
  return value === PLAYER_PROFILE_SOURCE || value === PLAYER_PROFILE_SHARE_SOURCE ? value : null
}
