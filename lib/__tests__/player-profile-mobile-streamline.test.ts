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
    expect(page).toContain('Player focus')
    expect(page).toContain('Train next')
    expect(page).toContain('Start this focus')
    expect(page).toContain('href={playerPathLevelUpHref}')
    expect(page).toContain('/player-profile/journey-hero.png')
    expect(page).not.toContain('/player-profile/player-id-court.png')
    expect(styles).toMatch(/\.playerFocusVisual\s*\{[\s\S]*?min-height:\s*148px/)
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

  it('puts verified visual stats on the public profile before deeper reads', () => {
    expect(page).toContain("const heroSecondaryHref = isPublicExplorerProfile ? '#profile-performance' : '#profile-matches'")
    expect(page).toContain("{isPublicExplorerProfile ? 'Stats' : 'Matches'}")
    expect(page).toContain('const publicPerformanceStats = [')
    expect(page).toContain('id="profile-performance"')
    expect(page).toContain('aria-label="Player performance snapshot"')
    expect(page).toContain("label: 'Record'")
    expect(page).toContain("label: 'Win rate'")
    expect(page).toContain("label: 'Match mix'")
    expect(page).toContain("label: 'TIQ movement'")
    expect(styles).toContain('.performanceStatGrid')
    expect(styles).toMatch(/\.performanceStatGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  })

  it('uses a compact rating trend and score-aware result tiles for public profiles', () => {
    expect(page).toContain('const publicRecentResults = visibleLastFive.map')
    expect(page).toContain('const publicTrendPoints = chartPoints.slice(-10)')
    expect(page).toContain('<RatingSparkline points={publicTrendPoints} />')
    expect(page).toContain('aria-label="Recent scorecards"')
    expect(page).toContain('vs {match.opponent}')
    expect(page).toContain('{!isPublicExplorerProfile ? <div id="profile-match-strip"')
    expect(page).toContain('function RatingSparkline')
    expect(styles).toContain('.ratingPulse')
    expect(styles).toContain('.recentResultTileGrid')
    expect(styles).toContain(".recentResultTile[data-result='W']")
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
  })
})
