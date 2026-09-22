export const SCORECARD_SIGNUP_SOURCE = 'scorecard_share'

const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getScorecardClaimPlayerId(nextHref: string) {
  if (!nextHref.startsWith('/profile?')) return null
  const params = new URLSearchParams(nextHref.slice(nextHref.indexOf('?') + 1))
  if ([...params.keys()].some((key) => key !== 'player')) return null
  const playerId = params.get('player')?.trim() || ''
  return PLAYER_ID_PATTERN.test(playerId) ? playerId : null
}

export function isScorecardSignupIntent(source: unknown, planId: string, nextHref: string) {
  return source === SCORECARD_SIGNUP_SOURCE
    && planId === 'free'
    && (nextHref === '/profile' || Boolean(getScorecardClaimPlayerId(nextHref)))
}

export function buildScorecardPlayerClaimHref(playerId: string) {
  const nextHref = `/profile?player=${encodeURIComponent(playerId)}`
  return `/join?plan=free&next=${encodeURIComponent(nextHref)}&source=${SCORECARD_SIGNUP_SOURCE}`
}
