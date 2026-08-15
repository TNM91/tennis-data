import { describe, expect, it } from 'vitest'
import {
  competitionAffectsTiqRating,
  competitionPublishesMatchHistory,
  getClubCompetitionRatingModeDescription,
  normalizeClubCompetitionRatingMode,
} from '../club-competition'
import { clubMembershipUsesExistingAccount, describeClubAccountConnection } from '../club-membership'

describe('club competition policy', () => {
  it('defaults existing TIQ competition to rated so current records keep their behavior', () => {
    expect(normalizeClubCompetitionRatingMode(undefined)).toBe('tiq_rated')
    expect(competitionAffectsTiqRating('tiq_rated')).toBe(true)
    expect(competitionPublishesMatchHistory('tiq_rated')).toBe(true)
  })

  it('supports standings without changing TIQ ratings', () => {
    expect(competitionAffectsTiqRating('club_standings')).toBe(false)
    expect(competitionPublishesMatchHistory('club_standings')).toBe(true)
    expect(getClubCompetitionRatingModeDescription('club_standings')).toContain('do not change TIQ ratings')
  })

  it('keeps social results out of national history and ratings', () => {
    expect(competitionAffectsTiqRating('social')).toBe(false)
    expect(competitionPublishesMatchHistory('social')).toBe(false)
  })
})

describe('club membership policy', () => {
  it('adds a club affiliation to the existing account', () => {
    expect(clubMembershipUsesExistingAccount()).toBe(true)
    expect(describeClubAccountConnection(true)).toContain('same TenAceIQ account')
    expect(describeClubAccountConnection(true)).toContain('match history')
  })
})
