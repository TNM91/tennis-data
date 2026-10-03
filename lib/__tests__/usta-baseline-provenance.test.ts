import { describe, expect, it } from 'vitest'
import { hasVerifiedUstaBaseline } from '../player-rating-display'

describe('published USTA baseline provenance', () => {
  it('requires explicit verification instead of trusting an imported numeric baseline', () => {
    expect(hasVerifiedUstaBaseline({ rating_source: 'verified' })).toBe(true)
    for (const source of ['unknown', 'inferred', 'self', '', null, undefined]) {
      expect(hasVerifiedUstaBaseline({ rating_source: source })).toBe(false)
    }
    expect(hasVerifiedUstaBaseline(null)).toBe(false)
  })
})
