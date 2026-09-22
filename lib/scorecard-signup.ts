export const SCORECARD_SIGNUP_SOURCE = 'scorecard_share'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getScorecardClaimContext(nextHref: string) {
  if (!nextHref.startsWith('/profile?')) return null
  const params = new URLSearchParams(nextHref.slice(nextHref.indexOf('?') + 1))
  if ([...params.keys()].some((key) => key !== 'player' && key !== 'match')) return null
  if (params.getAll('player').length !== 1 || params.getAll('match').length > 1) return null
  const playerId = params.get('player')?.trim() || ''
  const matchId = params.get('match')?.trim() || ''
  if (!UUID_PATTERN.test(playerId) || (params.has('match') && !UUID_PATTERN.test(matchId))) return null
  return { playerId, matchId: matchId || null }
}

export function getScorecardClaimPlayerId(nextHref: string) {
  return getScorecardClaimContext(nextHref)?.playerId || null
}

export function getScorecardClaimMatchId(nextHref: string) {
  return getScorecardClaimContext(nextHref)?.matchId || null
}

export function isScorecardSignupIntent(source: unknown, planId: string, nextHref: string) {
  return source === SCORECARD_SIGNUP_SOURCE
    && planId === 'free'
    && (nextHref === '/profile' || Boolean(getScorecardClaimPlayerId(nextHref)))
}

export function buildScorecardPlayerClaimHref(playerId: string, matchId?: string) {
  const nextHref = `/profile?player=${encodeURIComponent(playerId)}${matchId ? `&match=${encodeURIComponent(matchId)}` : ''}`
  return `/join?plan=free&next=${encodeURIComponent(nextHref)}&source=${SCORECARD_SIGNUP_SOURCE}`
}
