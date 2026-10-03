import { describe, expect, it } from 'vitest'
import { formatRatingValue } from '../player-rating-display'
describe('rating display at band boundaries', () => {
  it('does not round a lower-band estimate into the next band', () => {
    expect(formatRatingValue(4.499)).toBe('4.49')
    expect(formatRatingValue(4.999)).toBe('4.99')
    expect(formatRatingValue(5)).toBe('5.00')
    expect(formatRatingValue(4.6288)).toBe('4.63')
  })
})
import { getRatingProgressToNextLevel } from '../recalculateRatings'
it('starts a new TIQ band at zero progress and preserves values below its boundary', () => {
  expect(getRatingProgressToNextLevel(4.5)).toMatchObject({ previous: 4.5, next: 5, progressPct: 0 })
  expect(getRatingProgressToNextLevel(4.4997)).toMatchObject({ previous: 4, next: 4.5 })
})
