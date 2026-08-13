import { describe, expect, it } from 'vitest'

import {
  getClubCompetitionResultPolicy,
  normalizeClubCompetitionResultMode,
} from '../club-competition'

describe('Club competition result policy', () => {
  it('defaults existing competitions to TIQ rated', () => {
    expect(normalizeClubCompetitionResultMode(undefined)).toBe('tiq_rated')
    expect(getClubCompetitionResultPolicy('tiq_rated')).toEqual({
      ratingEligible: true,
      publicHistoryEligible: true,
    })
  })

  it('keeps public-history results visible without changing ratings', () => {
    expect(getClubCompetitionResultPolicy('public_history')).toEqual({
      ratingEligible: false,
      publicHistoryEligible: true,
    })
  })

  it('keeps social results out of ratings and public history', () => {
    expect(getClubCompetitionResultPolicy('social')).toEqual({
      ratingEligible: false,
      publicHistoryEligible: false,
    })
  })
})
