import { describe, expect, it } from 'vitest'
import { getPlanDestinationHref, getPlanSignupHref, getPlanUnlockHref } from '../plan-intent'

describe('plan intent routing', () => {
  it('routes Coach plan intent to the Coach workspace first', () => {
    expect(getPlanDestinationHref('coach')).toBe('/coach')
    expect(getPlanUnlockHref('coach')).toBe('/upgrade?plan=coach&next=%2Fcoach')
    expect(getPlanSignupHref('coach')).toBe('/join?plan=coach&next=%2Fupgrade%3Fplan%3Dcoach%26next%3D%252Fcoach')
  })

  it('keeps Full-Court centered on the operations workspace', () => {
    expect(getPlanDestinationHref('full_court')).toBe('/league-coordinator')
  })
})
