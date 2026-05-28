import { describe, expect, it } from 'vitest'

import { ADSENSE_IMPLEMENTATION_GUIDELINES } from '../adsense-guidelines'
import { isAdSafePath } from '../adsense'

describe('AdSense private route exclusions', () => {
  it('keeps Coach and Tactical Studio surfaces ad-free', () => {
    expect(isAdSafePath('/coach')).toBe(false)
    expect(isAdSafePath('/coach/invite/test-token')).toBe(false)
    expect(isAdSafePath('/tactics')).toBe(false)

    expect(ADSENSE_IMPLEMENTATION_GUIDELINES.join(' ')).toContain('Coach')
    expect(ADSENSE_IMPLEMENTATION_GUIDELINES.join(' ')).toContain('Tactical Studio')
  })

  it('still allows prepared public tennis routes', () => {
    expect(isAdSafePath('/players')).toBe(true)
    expect(isAdSafePath('/players/test-player')).toBe(true)
    expect(isAdSafePath('/leagues')).toBe(true)
  })
})
