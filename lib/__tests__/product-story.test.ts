import { describe, expect, it } from 'vitest'
import { DATA_ASSIST_STORY, MEMBERSHIP_TIERS, PRODUCT_AVOID_LIST } from '../product-story'

describe('product story guardrails', () => {
  it('keeps Data Assist positioned as reviewed user uploads instead of an API dependency', () => {
    expect(DATA_ASSIST_STORY.body).toContain('uploads')
    expect(DATA_ASSIST_STORY.body).toContain('instead of relying on a direct USTA API')
    expect(DATA_ASSIST_STORY.proof).toContain('Review keeps imported data trustworthy')
    expect(PRODUCT_AVOID_LIST).toContain('Promises that imply direct USTA API dependence')
  })

  it('keeps Free distinct from paid unlock tiers', () => {
    expect(MEMBERSHIP_TIERS.free.description).toContain('public tennis intelligence')
    expect(MEMBERSHIP_TIERS.player_plus.valueProps).toContain('Unlock My Lab')
    expect(MEMBERSHIP_TIERS.captain.description).toContain('Use Player features plus captain tools')
    expect(MEMBERSHIP_TIERS.league.valueProps).toContain('Use Data Assist uploads for schedules, rosters, and official scorecards')
  })
})
