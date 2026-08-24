import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/players/[id]/player-profile-story.module.css'), 'utf8')

describe('player profile mobile streamline', () => {
  it('puts the public stats path ahead of personal tooling', () => {
    expect(page).toContain("const heroSecondaryHref = isPublicExplorerProfile ? '#profile-performance' : '#profile-matches'")
    expect(page).toContain("const heroSecondaryLabel = isPublicExplorerProfile ? 'Review stats' : 'Recent matches'")
    expect(page).toContain('id="profile-matches"')
    expect(page).toContain('className={profileStory.historyGroup}')
  })

  it('keeps one rating story and compresses low-evidence states on mobile', () => {
    expect(page).toContain('chartPoints.length > 1')
    expect(page).toContain('First reviewed result')
    expect(page).toContain('The next reviewed match begins the trend.')
    expect(page).toContain('className={profileStory.secondaryTrend}')
    expect(styles).toMatch(/\.secondaryTrend\s*\{[\s\S]*?display:\s*none\s*!important;/)
  })

  it('preserves paid visuals while removing empty interruptions', () => {
    expect(page).toContain("data-own-profile={hasPersonalPlayerExperience}")
    expect(page).toContain('{playerAwards.length > 0 ? (')
    expect(styles).toContain(".playerCardPreview[data-own-profile='true']")
    expect(styles).toMatch(/\.ratingMeta\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  })

  it('reserves the Player ID coaching read for a linked Player member', () => {
    expect(page).toContain('const hasPersonalPlayerExperience = isOwnProfile && access.canUseAdvancedPlayerInsights')
    expect(page).toContain('{hasPersonalPlayerExperience ? <a href="#profile-player-id">Player ID</a> : null}')
    expect(page).toContain('{hasPersonalPlayerExperience ? (')
    expect(page).toContain('<section id="profile-player-id"')
    expect(page).toContain('<details className={profileStory.playerFocusDisclosure}>')
    expect(page).toContain('Open focus')
    expect(page).toContain('Player focus')
    expect(page).toContain('Train next')
    expect(page).toContain('Start this focus')
    expect(page).toContain('href={playerPathLevelUpHref}')
    expect(page).toContain('/player-profile/journey-hero.png')
    expect(page).not.toContain('/player-profile/player-id-court.png')
    expect(styles).toMatch(/\.playerFocusVisual\s*\{[\s\S]*?min-height:\s*148px/)
    expect(styles).toContain('.playerFocusDisclosureContent')
    expect(styles).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.playerFocusProof,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
  })

  it('uses phone-first season cards and keeps the Player upgrade small', () => {
    expect(page).toContain('isMobile ? (')
    expect(page).toContain('seasonMobileListStyle')
    expect(page).toContain('Unlock Player for My Lab, saved reads, and personal coaching.')
    expect(styles).toContain('.playerAccessHint')
  })

  it('does not duplicate scorecards before the complete results history', () => {
    expect(page).not.toContain('aria-label="Recent form preview"')
    expect(page).not.toContain('Latest scorecards')
    expect(page).not.toContain('Open match history')
    expect(page).toContain('Latest match history')
    expect(page).toContain('{hasTrackedMatches ? (')
  })

  it('gives linked free accounts the same compact public snapshot as explorers', () => {
    expect(page).toContain('const isLinkedFreeProfile = isOwnProfile && !hasPersonalPlayerExperience')
    expect(page).toContain('const isPublicExplorerProfile = !hasPersonalPlayerExperience')
    expect(page).toContain("const heroEyebrow = isPublicExplorerProfile ? 'Player snapshot' : 'Your tennis journey'")
    expect(page).toContain("const heroSecondaryLabel = isPublicExplorerProfile ? 'Review stats' : 'Recent matches'")
    expect(page).toContain("data-public-profile={isPublicExplorerProfile}")
    expect(page).toContain("'Compare players'")
    expect(styles).toContain(".storyHero[data-public-profile='true'] .storyContent")
  })

  it('keeps the phone section rail focused when no team context exists', () => {
    expect(page).toContain('const hasTeamProfileContext = Boolean(primaryTeamHref) || tiqParticipations.length > 0')
    expect(page).toContain("{hasTeamProfileContext ? <Link href={primaryTeamHref || '#profile-teams'}>Teams</Link> : null}")
  })

  it('puts verified visual stats on the public profile before deeper reads', () => {
    expect(page).toContain("const heroSecondaryHref = isPublicExplorerProfile ? '#profile-performance' : '#profile-matches'")
    expect(page).toContain("{isPublicExplorerProfile ? 'Stats' : 'Matches'}")
    expect(page).toContain('const publicPerformanceStats = [')
    expect(page).toContain('id="profile-performance"')
    expect(page).toContain('aria-label="Player performance snapshot"')
    expect(page).toContain('aria-label="Recent result form"')
    expect(page).toContain('const recentFormWins = visibleLastFive.filter')
    expect(page).toContain('const recentFormLosses = visibleLastFive.filter')
    expect(page).toContain("label: 'Record'")
    expect(page).toContain("label: 'Win rate'")
    expect(page).toContain("label: ratingView === 'overall' ? 'Match mix' : 'Reviewed'")
    expect(page).toContain("label: 'TIQ movement'")
    expect(styles).toContain('.performanceStatGrid')
    expect(styles).toContain('.courtFormRail')
    expect(styles).toContain('.courtFormMarks')
    expect(styles).toMatch(/\.performanceStatGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  })

  it('uses a compact rating trend and score-aware result tiles for public profiles', () => {
    expect(page).toContain('const publicRecentResults = filteredMatches.slice(0, showAllPublicResults ? undefined : 3).map')
    expect(page).toContain('const publicTrendPoints = chartPoints.slice(-10)')
    expect(page).toContain('<RatingSparkline points={publicTrendPoints} />')
    expect(page).toContain('aria-label="Recent scorecards"')
    expect(page).toContain('>Match tape</span>')
    expect(page).toContain('<span>Opponent</span>')
    expect(page).toContain('{match.context}</span>')
    expect(page).toContain('{!isPublicExplorerProfile ? <div id="profile-match-strip"')
    expect(page).toContain('function RatingSparkline')
    expect(styles).toContain('.ratingPulse')
    expect(styles).toContain('.recentResultTileGrid')
    expect(styles).toContain('.recentResultTileTopline')
    expect(styles).toContain('.recentResultOpponent')
    expect(styles).toContain('.recentResultTileMeta')
    expect(styles).toContain(".recentResultTile[data-result='W']")
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)')
  })

  it('uses a short, expandable timeline instead of five equal phone cards', () => {
    expect(page).toContain('const [showAllPublicResults, setShowAllPublicResults] = useState(false)')
    expect(page).toContain('filteredMatches.slice(0, showAllPublicResults ? undefined : 3)')
    expect(page).toContain('View full match tape (${filteredMatches.length})')
    expect(page).toContain('Show recent three')
    expect(page).toContain('aria-expanded={showAllPublicResults}')
    expect(styles).toContain('.recentResultSnapshotAction')
    expect(styles).toContain(".recentResultTile[data-result='W'] {")
    expect(styles).toContain('.recentResultOutcome')
    expect(styles).toContain('.recentResultScore > strong')
  })

  it('keeps the compact trend primary on phones and makes the full chart optional', () => {
    expect(page).toContain('const [showMobileRatingHistory, setShowMobileRatingHistory] = useState(false)')
    expect(page).toContain('const showDetailedRatingHistory = !isMobile || showMobileRatingHistory')
    expect(page).toContain('chartPoints.length > 1 && showDetailedRatingHistory')
    expect(page).toContain('View rating history')
    expect(page).toContain('Hide rating history')
    expect(page).toContain('aria-expanded={showMobileRatingHistory}')
    expect(styles).toContain('.ratingHistorySummary')
    expect(styles).toContain('.ratingHistoryAction')
  })

  it('turns the collapsed rating history into a compact TIQ journey read', () => {
    expect(page).toContain('const compactJourneyPoints = chartPoints.slice(-6)')
    expect(page).toContain('aria-label="Compact TIQ rating journey"')
    expect(page).toContain('<span>First result</span>')
    expect(page).toContain('<span>TIQ now</span>')
    expect(page).toContain('<span>Recent move</span>')
    expect(page).toContain('<RatingSparkline points={compactJourneyPoints} />')
    expect(styles).toContain('.ratingJourneyPulse')
  })

  it('adds factual match-quality visuals to the public performance read', () => {
    expect(page).toContain('const publicMatchQuality = [')
    expect(page).toContain("const selectedMatchLabel = ratingView === 'overall' ? 'All matches' : `${capitalize(ratingView)} only`")
    expect(page).toContain("label: ratingView === 'overall' ? 'Match mix' : 'Reviewed'")
    expect(page).toContain("label: 'Scores captured'")
    expect(page).toContain("label: 'Current streak'")
    expect(page).toContain("label: 'Close scorecards'")
    expect(page).toContain("label: 'Avg opponent'")
    expect(page).toContain('aria-label="Match quality snapshot"')
    expect(styles).toContain('.matchQualitySnapshot')
    expect(styles).toContain('.matchQualityGrid')
    expect(styles).toContain('.matchQualityMetric')
  })

  it('uses earned tennis evidence for the profile achievement shelf and keeps TIQ separate from USTA proximity', () => {
    expect(page).toContain('const profileAchievementShowcase = useMemo')
    expect(page).toContain("label: 'Match streak'")
    expect(page).toContain("label: 'Reviewed competitor'")
    expect(page).toContain('aria-label="Player achievements"')
    expect(page).toContain('className={profileStory.ratingTrajectory}')
    expect(page).toContain('USTA ${baseRating.toFixed(1)} toward ${nextThreshold.toFixed(1)}')
    expect(styles).toContain('.achievementShelf')
    expect(styles).toContain('.ratingTrajectory')
  })

  it('lets only a linked Player personalize up to three earned achievements on the public showcase', () => {
    const page = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
    const route = readFileSync(join(process.cwd(), 'app/api/player/achievement-showcase/route.ts'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260821000100_create_player_achievement_showcases.sql'), 'utf8')

    expect(page).toContain("'Edit showcase'")
    expect(page).toContain('saveFeaturedAchievement')
    expect(page).toContain('featuredAchievementKeys.length >= 3')
    expect(page).toContain('Choose up to three earned badges for your public profile.')
    expect(page).toContain("featuredKeys: nextFeaturedKeys")
    expect(page).toContain("data-featured={featuredAchievementKeys.includes(achievement.key)}")
    expect(route).toContain('getPlayerApiAuth')
    expect(route).toContain("linked_player_id !== playerId")
    expect(route).toContain('loadEligibleAchievementKeys')
    expect(migration).toContain('Public can read player achievement showcases')
    expect(migration).toContain('Players can update their own achievement showcase')
  })

  it('uses the Trophy Case badge collection for the public profile showcase', () => {
    const page = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
    const styles = readFileSync(join(process.cwd(), 'app/players/[id]/player-profile-story.module.css'), 'utf8')

    expect(page).toContain('buildPlayerTrophyBadges')
    expect(page).toContain('featuredTrophyBadge')
    expect(page).toContain('Featured trophy')
    expect(page).toContain('badge{earnedTrophyBadges.length === 1')
    expect(styles).toContain('.featuredTrophyBadge')
  })
})
