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
