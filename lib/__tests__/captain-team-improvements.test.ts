import { describe, expect, it } from 'vitest'
import { buildCaptainTeamImprovements } from '../captain-team-improvements'

describe('Captain team improvements', () => {
  it('prioritizes a missing roster and schedule without showing contact or rating gaps', () => {
    expect(buildCaptainTeamImprovements({
      rosterCount: 0,
      missingPhoneCount: 0,
      missingRatingCount: 0,
      scheduleCount: 0,
      appearanceCount: 0,
    }).map((item) => item.id)).toEqual(['roster', 'schedule'])
  })

  it('quantifies contact and rating gaps for an existing roster', () => {
    const improvements = buildCaptainTeamImprovements({
      rosterCount: 10,
      missingPhoneCount: 8,
      missingRatingCount: 3,
      scheduleCount: 9,
      appearanceCount: 12,
    })

    expect(improvements.map((item) => item.id)).toEqual(['contacts', 'ratings'])
    expect(improvements[0]).toMatchObject({
      title: 'Add team phone numbers',
      state: '8 missing',
      cta: 'Add phone numbers',
    })
  })

  it('suggests one scorecard when roster and schedule exist without match history', () => {
    expect(buildCaptainTeamImprovements({
      rosterCount: 10,
      missingPhoneCount: 0,
      missingRatingCount: 0,
      scheduleCount: 8,
      appearanceCount: 0,
    })).toEqual([
      expect.objectContaining({ id: 'scorecard', title: 'Add recent match results' }),
    ])
  })

  it('disappears when the selected team has no meaningful data gaps', () => {
    expect(buildCaptainTeamImprovements({
      rosterCount: 10,
      missingPhoneCount: 0,
      missingRatingCount: 0,
      scheduleCount: 8,
      appearanceCount: 18,
    })).toEqual([])
  })
})
