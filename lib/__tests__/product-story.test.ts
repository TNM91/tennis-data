import { describe, expect, it } from 'vitest'
import {
  DATA_ASSIST_STORY,
  MEMBERSHIP_TIERS,
  PLATFORM_AUDIENCE_PATHS,
  PLATFORM_PILLARS,
  PLATFORM_POSITIONING,
  PRODUCT_AVOID_LIST,
  PRODUCT_MODE_LANGUAGE,
  PRODUCT_NORTH_STAR,
  TIER_HOMEPAGE_STORY,
} from '../product-story'

describe('product story guardrails', () => {
  it('keeps Data Assist positioned as reviewed user uploads instead of an API dependency', () => {
    expect(DATA_ASSIST_STORY.body).toContain('uploads')
    expect(DATA_ASSIST_STORY.body).toContain('instead of relying on a direct USTA API')
    expect(DATA_ASSIST_STORY.href).toBe('/data-assist?intent=upload-source&context=Product%20story')
    expect(DATA_ASSIST_STORY.proof).toContain('Review keeps imported data trustworthy')
    expect(PRODUCT_AVOID_LIST).toContain('Promises that imply direct USTA API dependence')
  })

  it('keeps Free distinct from paid unlock tiers', () => {
    expect(MEMBERSHIP_TIERS.free.description).toContain('public tennis intelligence')
    expect(MEMBERSHIP_TIERS.player_plus.valueProps).toContain('Unlock My Lab')
    expect(MEMBERSHIP_TIERS.coach.description).toContain('Use Player features plus Coach Hub')
    expect(MEMBERSHIP_TIERS.captain.description).toContain('Use Player features plus Team Hub and Captain Tools')
    expect(MEMBERSHIP_TIERS.league.valueProps).toContain('Use Data Assist uploads for schedules, rosters, and official scorecards')
    expect(MEMBERSHIP_TIERS.full_court.upgradeCue).toContain('Coach Hub, Team Hub, League Office')
    expect(MEMBERSHIP_TIERS.full_court.description).toContain('unlimited Tournament Desk operations')
    expect(MEMBERSHIP_TIERS.full_court.description).toContain('as one tennis operation')
    expect(TIER_HOMEPAGE_STORY.full_court.copy).toContain('around one tennis operation')
    expect(Object.values(MEMBERSHIP_TIERS).map((tier) => tier.description).join(' ')).not.toContain('Player plus')
    expect(`${MEMBERSHIP_TIERS.full_court.description} ${TIER_HOMEPAGE_STORY.full_court.copy}`).not.toContain('suite')
  })

  it('keeps user-facing mode language mapped to the right formal tiers', () => {
    expect(PRODUCT_MODE_LANGUAGE.find).toMatchObject({ label: 'Explore', route: '/explore', planId: 'free' })
    expect(PRODUCT_MODE_LANGUAGE.you).toMatchObject({ label: 'My Lab', route: '/mylab', planId: 'player_plus' })
    expect(PRODUCT_MODE_LANGUAGE.coach).toMatchObject({ label: 'Coach', route: '/coach', planId: 'coach' })
    expect(PRODUCT_MODE_LANGUAGE.prep).toMatchObject({ label: 'Prep', route: '/matchup', planId: 'player_plus' })
    expect(PRODUCT_MODE_LANGUAGE.team).toMatchObject({ label: 'Team', route: '/captain', planId: 'captain' })
    expect(PRODUCT_MODE_LANGUAGE.league).toMatchObject({ label: 'Leagues', route: '/league-coordinator', planId: 'league' })
    expect(PRODUCT_MODE_LANGUAGE.plans).toMatchObject({ label: 'Pricing', route: '/pricing', planId: null })
    expect(PRODUCT_MODE_LANGUAGE.plans.cue).toContain('My Lab, Coach Hub, Team Hub, League Office')
  })

  it('keeps the clarified platform why centralized', () => {
    expect(PRODUCT_NORTH_STAR).toContain('players, captains, coaches, leagues, and tournaments')
    expect(PRODUCT_NORTH_STAR).toContain('spend less time managing, guessing, searching, and coordinating')
    expect(PLATFORM_POSITIONING).toBe(
      'The tennis platform that helps players, captains, coaches, leagues, and tournaments improve, compete, and manage the game with less friction.',
    )
    expect(PLATFORM_PILLARS.map((pillar) => pillar.title)).toEqual(['Improve', 'Compete', 'Manage'])
    expect(PLATFORM_PILLARS.map((pillar) => pillar.href)).toEqual(['/player-development', '/compete', '/manage'])
    expect(PLATFORM_AUDIENCE_PATHS.map((path) => path.audience)).toEqual([
      'Players',
      'Captains',
      'Coaches',
      'Leagues and tournaments',
    ])
  })
})
