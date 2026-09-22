import { describe, expect, it } from 'vitest'
import { isScorecardSignupIntent, SCORECARD_SIGNUP_SOURCE } from '@/lib/scorecard-signup'

describe('scorecard signup intent', () => {
  it('accepts only a free player-profile handoff from the scorecard source', () => {
    expect(isScorecardSignupIntent(SCORECARD_SIGNUP_SOURCE, 'free', '/profile')).toBe(true)
    expect(isScorecardSignupIntent(SCORECARD_SIGNUP_SOURCE, 'player_plus', '/profile')).toBe(false)
    expect(isScorecardSignupIntent(SCORECARD_SIGNUP_SOURCE, 'free', '/explore')).toBe(false)
    expect(isScorecardSignupIntent('direct', 'free', '/profile')).toBe(false)
  })
})
