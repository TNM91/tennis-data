export const PLAYER_PROFILE_SOURCE = 'player_profile'
export const PLAYER_PROFILE_SHARE_SOURCE = 'player_profile_share'
export type PlayerProfileSource = typeof PLAYER_PROFILE_SOURCE | typeof PLAYER_PROFILE_SHARE_SOURCE

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function buildPlayerProfileConnectHref(playerId: string) {
  return `/profile?connectPlayer=${encodeURIComponent(playerId)}`
}

export function getPlayerProfileConnectPlayerId(href: string) {
  if (!href.startsWith('/profile?')) return null
  const url = new URL(href, 'https://tenaceiq.invalid')
  if (url.pathname !== '/profile' || url.hash) return null
  if ([...url.searchParams.keys()].some((key) => key !== 'connectPlayer')) return null
  if (url.searchParams.getAll('connectPlayer').length !== 1) return null
  const playerId = url.searchParams.get('connectPlayer')?.trim() || ''
  return UUID_PATTERN.test(playerId) ? playerId : null
}

export function getPlayerProfileAcquisitionSource(value: unknown, planId: string, nextHref: string): PlayerProfileSource | null {
  if (planId !== 'free' || (nextHref !== '/profile#profile-identity' && !getPlayerProfileConnectPlayerId(nextHref))) return null
  return value === PLAYER_PROFILE_SOURCE || value === PLAYER_PROFILE_SHARE_SOURCE ? value : null
}
