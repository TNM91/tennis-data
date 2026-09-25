import { describe, expect, it } from 'vitest'
import { getPlanCheckoutHref, getPlanDestinationHref, getPlanSignupHref, getPlanUnlockHref, isSafeLocalNextHref } from '../plan-intent'

describe('plan intent routing', () => {
  it('keeps a paid choice through sign-in and opens checkout on return', () => {
    expect(getPlanCheckoutHref('player_plus', '/mylab')).toBe('/upgrade?plan=player_plus&next=%2Fmylab&checkout=auto')
  })

  it('routes Coach plan intent to the Coach workspace first', () => {
    expect(getPlanDestinationHref('coach')).toBe('/coach')
    expect(getPlanUnlockHref('coach')).toBe('/upgrade?plan=coach&next=%2Fcoach')
    expect(getPlanSignupHref('coach')).toBe('/join?plan=coach&next=%2Fupgrade%3Fplan%3Dcoach%26next%3D%252Fcoach')
  })

  it('keeps Full-Court centered on the operations workspace', () => {
    expect(getPlanDestinationHref('full_court')).toBe('/league-coordinator')
  })

  it('routes the free tier to a genuinely free destination', () => {
    expect(getPlanDestinationHref('free')).toBe('/explore')
  })

  it('rejects external, backslash, control-character, and auth-loop redirects', () => {
    const fallback = '/explore'
    expect(isSafeLocalNextHref('//evil.example', fallback)).toBe(fallback)
    expect(isSafeLocalNextHref('/\\evil.example', fallback)).toBe(fallback)
    expect(isSafeLocalNextHref('/%5cevil.example', fallback)).toBe(fallback)
    expect(isSafeLocalNextHref('/login/reset', fallback)).toBe(fallback)
    expect(isSafeLocalNextHref('/join/team', fallback)).toBe(fallback)
    expect(isSafeLocalNextHref('/players/1?tab=results#season', fallback)).toBe('/players/1?tab=results#season')
  })
})
