import { describe, expect, it } from 'vitest'
import { buildRatingBaselineAlignment } from '../tennisrecord/service'

describe('TiQ verified-baseline alignment', () => {
  it('separates confirmed players who are steady, building, and genuinely below their baseline', () => {
    const alignment = buildRatingBaselineAlignment([
      { id: 'steady', rating_source: 'verified', overall_rating: 4, overall_dynamic_rating: 4.04 },
      { id: 'building', rating_source: 'verified', overall_rating: 4, overall_dynamic_rating: 4.18 },
      { id: 'below', rating_source: 'verified', overall_rating: 4, overall_dynamic_rating: 3.9 },
      { id: 'materially-below', rating_source: 'verified', overall_rating: 4, overall_dynamic_rating: 3.85 },
      { id: 'self-rated', rating_source: 'self', overall_rating: 4, overall_dynamic_rating: 3.5 },
    ])

    expect(alignment).toEqual({
      verifiedPlayers: 4,
      atOrNearBaseline: 1,
      buildingAboveBaseline: 1,
      belowBaseline: 2,
      materiallyBelowBaseline: 1,
    })
  })
})
