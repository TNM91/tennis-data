export const SCORECARD_SIGNUP_SOURCE = 'scorecard_share'

export function isScorecardSignupIntent(source: unknown, planId: string, nextHref: string) {
  return source === SCORECARD_SIGNUP_SOURCE && planId === 'free' && nextHref === '/profile'
}
