import { describe, expect, it } from 'vitest'
import { buildScorecardPlayerClaimHref, getScorecardClaimPlayerId, isScorecardSignupIntent, SCORECARD_SIGNUP_SOURCE } from '@/lib/scorecard-signup'

describe('scorecard signup intent', () => {
  it('accepts only a free player-profile handoff from the scorecard source', () => {
    expect(isScorecardSignupIntent(SCORECARD_SIGNUP_SOURCE, 'free', '/profile')).toBe(true)
    expect(isScorecardSignupIntent(SCORECARD_SIGNUP_SOURCE, 'player_plus', '/profile')).toBe(false)
    expect(isScorecardSignupIntent(SCORECARD_SIGNUP_SOURCE, 'free', '/explore')).toBe(false)
    expect(isScorecardSignupIntent('direct', 'free', '/profile')).toBe(false)
  })

  it('carries a validated scorecard player into the profile handoff', () => {
    const playerId = 'ba687267-2f42-4a5c-9052-518de1f8b495'
    const nextHref = `/profile?player=${playerId}`

    expect(getScorecardClaimPlayerId(nextHref)).toBe(playerId)
    expect(isScorecardSignupIntent(SCORECARD_SIGNUP_SOURCE, 'free', nextHref)).toBe(true)
    expect(buildScorecardPlayerClaimHref(playerId)).toBe(`/join?plan=free&next=${encodeURIComponent(nextHref)}&source=scorecard_share`)
    expect(getScorecardClaimPlayerId('/profile?player=not-a-player')).toBeNull()
    expect(getScorecardClaimPlayerId(`${nextHref}&returnTo=/admin`)).toBeNull()
  })
})
