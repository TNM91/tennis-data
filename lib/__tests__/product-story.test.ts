import { describe, expect, it } from 'vitest'
import { COACH_TACTICS_BOARD_HREF } from '../tactics-hrefs'
import {
  DATA_ASSIST_STORY,
  HOME_HERO_STORY,
  MEMBERSHIP_TIERS,
  PLATFORM_AUDIENCE_PATHS,
  PLATFORM_MISSION,
  PLATFORM_PILLARS,
  PLATFORM_POSITIONING,
  PRODUCT_AVOID_LIST,
  PRODUCT_LANGUAGE_SYSTEM,
  PRODUCT_MODE_LANGUAGE,
  PRODUCT_NORTH_STAR,
  PRODUCT_PRINCIPLES,
  PRODUCT_UPGRADE_MESSAGE,
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
    expect(MEMBERSHIP_TIERS.free.description).toContain('tennis context for free')
    expect(MEMBERSHIP_TIERS.free.description).toContain('tournaments')
    expect(TIER_HOMEPAGE_STORY.free.copy).toContain('before choosing paid tools')
    expect(MEMBERSHIP_TIERS.player_plus.valueProps).toContain('Unlock My Lab')
    expect(MEMBERSHIP_TIERS.coach.description).toContain('Use Player features plus Coach Hub')
    expect(MEMBERSHIP_TIERS.captain.description).toContain('Use Player features plus Team Hub and Captain Tools')
    expect(MEMBERSHIP_TIERS.league.valueProps).toContain('Use Data Assist uploads for schedules, rosters, and official scorecards')
    expect(MEMBERSHIP_TIERS.full_court.shortPromise).toBe('Support every tennis role.')
    expect(MEMBERSHIP_TIERS.full_court.audience).toContain('players, teams, leagues, and tournaments')
    expect(MEMBERSHIP_TIERS.full_court.upgradeCue).toContain('Coach Hub, Team Hub, League Office')
    expect(MEMBERSHIP_TIERS.full_court.description).toContain('unlimited Tournament Desk runs')
    expect(MEMBERSHIP_TIERS.full_court.description).toContain('tournaments')
    expect(MEMBERSHIP_TIERS.full_court.valueProps).toContain('My Lab, Coach Hub, Team Hub, and League Office together')
    expect(MEMBERSHIP_TIERS.full_court.valueProps).toContain('One connected tennis path for coaches, captains, coordinators, and organizers')
    expect(TIER_HOMEPAGE_STORY.full_court.headline).toBe('Support every tennis role.')
    expect(TIER_HOMEPAGE_STORY.full_court.copy).toContain('Tournament Desk tools')
    expect(TIER_HOMEPAGE_STORY.coach.secondaryCta?.href).toBe(COACH_TACTICS_BOARD_HREF)
    expect(Object.values(MEMBERSHIP_TIERS).map((tier) => tier.description).join(' ')).not.toContain('Player plus')
    expect(`${MEMBERSHIP_TIERS.free.description} ${TIER_HOMEPAGE_STORY.free.copy}`).not.toContain('personal workspace')
    expect(`${MEMBERSHIP_TIERS.full_court.description} ${TIER_HOMEPAGE_STORY.full_court.copy}`).not.toContain('suite')
    expect(`${MEMBERSHIP_TIERS.full_court.shortPromise} ${MEMBERSHIP_TIERS.full_court.description} ${TIER_HOMEPAGE_STORY.full_court.headline}`).not.toContain('complete TenAceIQ toolkit')
    expect(`${MEMBERSHIP_TIERS.full_court.audience} ${MEMBERSHIP_TIERS.full_court.valueProps.join(' ')} ${TIER_HOMEPAGE_STORY.full_court.headline}`).not.toContain('full tennis operation')
    expect(`${TIER_HOMEPAGE_STORY.full_court.headline} ${TIER_HOMEPAGE_STORY.full_court.copy}`).not.toContain('Run the whole tennis operation')
  })

  it('keeps user-facing mode language mapped to the right formal tiers', () => {
    expect(PRODUCT_MODE_LANGUAGE.find).toMatchObject({ label: 'Explore', route: '/explore', planId: 'free' })
    expect(PRODUCT_MODE_LANGUAGE.you).toMatchObject({ label: 'My Lab', route: '/mylab', planId: 'player_plus' })
    expect(PRODUCT_MODE_LANGUAGE.coach).toMatchObject({ label: 'Coach', route: '/coach', planId: 'coach' })
    expect(PRODUCT_MODE_LANGUAGE.prep).toMatchObject({ label: 'Prep', route: '/matchup', planId: 'player_plus' })
    expect(PRODUCT_MODE_LANGUAGE.team).toMatchObject({ label: 'Team', route: '/captain', planId: 'captain' })
    expect(PRODUCT_MODE_LANGUAGE.league).toMatchObject({ label: 'Leagues', route: '/league-coordinator', planId: 'league' })
    expect(PRODUCT_MODE_LANGUAGE.plans).toMatchObject({ label: 'Pricing', route: '/pricing', planId: null })
    expect(PRODUCT_MODE_LANGUAGE.find.cue).toBe('Explore players, teams, leagues, rankings, tournaments, and tennis context for free.')
    expect(PRODUCT_MODE_LANGUAGE.plans.cue).toContain('right tools')
    expect(PRODUCT_MODE_LANGUAGE.plans.cue).toContain('league, or tournament')
    expect(PRODUCT_MODE_LANGUAGE.plans.cue).toContain('My Lab, Coach Hub, Team Hub, League Office')
    expect(PRODUCT_MODE_LANGUAGE.find.cue).not.toContain('paid workspace')
    expect(PRODUCT_MODE_LANGUAGE.plans.cue).not.toContain('needs a workspace')
    expect(`${PRODUCT_MODE_LANGUAGE.find.cue} ${PRODUCT_MODE_LANGUAGE.plans.cue}`).not.toContain('home base')
    expect(`${PRODUCT_MODE_LANGUAGE.find.cue} ${PRODUCT_MODE_LANGUAGE.plans.cue}`).not.toContain('tennis job')
  })

  it('keeps the clarified platform why centralized', () => {
    expect(PRODUCT_NORTH_STAR).toContain('players, captains, coaches, leagues, and tournament organizers')
    expect(PRODUCT_NORTH_STAR).toContain('spend less time searching, guessing, and coordinating')
    expect(PRODUCT_NORTH_STAR).toContain('more time playing, improving, coaching, captaining, and enjoying tennis')
    expect(PLATFORM_MISSION).toContain('more time playing, improving, and enjoying the sport')
    expect(HOME_HERO_STORY.body).toContain('Explore tennis context for free')
    expect(HOME_HERO_STORY.body).toContain('when you want more support')
    expect(HOME_HERO_STORY.body).not.toContain('the full court')
    expect(HOME_HERO_STORY.body).not.toContain('tennis job')
    expect(HOME_HERO_STORY.body).not.toContain('home base')
    expect(PLATFORM_POSITIONING).toBe(
      'The tennis platform that gives players, captains, coaches, leagues, and tournaments the context, tools, and resources to play, improve, and run competition with less friction.',
    )
    expect(PLATFORM_PILLARS.map((pillar) => pillar.title)).toEqual(['Improve', 'Compete', 'Manage'])
    expect(PLATFORM_PILLARS.map((pillar) => pillar.href)).toEqual(['/player-development', '/compete', '/manage'])
    expect(PLATFORM_PILLARS.map((pillar) => pillar.promise)).toEqual([
      'Turn player context into court work.',
      'Turn matchup context into a plan.',
      'Turn scattered admin into a cleaner week.',
    ])
    expect(PLATFORM_PILLARS.flatMap((pillar) => pillar.proof)).toEqual([
      'Player path',
      'Drill focus',
      'Coach handoff',
      'Matchup read',
      'Opponent scout',
      'Court plan',
      'Availability',
      'Schedules and scores',
      'Rosters',
    ])
    expect(PLATFORM_PILLARS.map((pillar) => pillar.body).join(' ')).not.toContain('player development paths, ratings, progress signals')
    expect(PLATFORM_PILLARS.map((pillar) => pillar.body).join(' ')).not.toContain('lineup strategy, match preparation, performance tracking')
    expect(PLATFORM_AUDIENCE_PATHS.map((path) => path.audience)).toEqual([
      'Players',
      'Captains',
      'Coaches',
      'Leagues and tournaments',
    ])
  })

  it('centralizes the approved toolkit language system', () => {
    expect(PRODUCT_LANGUAGE_SYSTEM.coreLine).toBe(
      'Explore tennis context for free. Unlock the right TenAceIQ tools when you are ready to play, improve, captain, coach, or run competition with less chaos.',
    )
    expect(PRODUCT_LANGUAGE_SYSTEM.mission).toContain('Spend less time searching, guessing, and coordinating')
    expect(PRODUCT_LANGUAGE_SYSTEM.umbrellaTerms).toEqual(['tools', 'toolkit', 'resources', 'tennis context', 'support', 'competition'])
    expect(PRODUCT_LANGUAGE_SYSTEM.roleTerms).toContain('Tournament Desk')
    expect(PRODUCT_LANGUAGE_SYSTEM.competitionTerms).toEqual({ league: 'season', tournament: 'event', shared: 'competition' })
    expect(PRODUCT_LANGUAGE_SYSTEM.discouragedPublicTerms).toContain('home base')
    expect(PRODUCT_LANGUAGE_SYSTEM.discouragedPublicTerms).toContain('tennis job')
    expect(PRODUCT_UPGRADE_MESSAGE).toContain('right tools')
    expect(PRODUCT_UPGRADE_MESSAGE).toContain('game, team, players, league, or tournament')
    expect(PRODUCT_PRINCIPLES).toContain('Practical tools over generic dashboards')
    expect(PRODUCT_PRINCIPLES).toContain('Competition tools for league and tournament organizers')
    expect(PRODUCT_AVOID_LIST).toContain('Home base or tennis job as umbrella language')
  })
})
