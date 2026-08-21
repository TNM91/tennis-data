import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/players/[id]/player-profile-story.module.css'), 'utf8')

describe('player profile mobile streamline', () => {
  it('puts owner actions and actual match history on the shortest path', () => {
    expect(page).toContain("{isOwnProfile ? 'Recent matches' : 'Open Player ID'}")
    expect(page).toContain("href={isOwnProfile ? '#profile-matches' : playerPathDevelopmentHref}")
    expect(page).toContain("'Share profile'")
    expect(page).toContain('profileStory.mobileOnlyAction')
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

  it('preserves premium visuals while removing empty and duplicate interruptions', () => {
    expect(page).toContain("data-own-profile={isOwnProfile}")
    expect(page).toContain("data-empty={playerAwards.length === 0}")
    expect(styles).toContain(".playerCardPreview[data-own-profile='true']")
    expect(styles).toContain(".milestoneStrip[data-empty='true']")
    expect(styles).toMatch(/\.ratingMeta\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  })

  it('turns Player ID into one focused, actionable mobile read', () => {
    expect(page).toContain('Player focus')
    expect(page).toContain('Train next')
    expect(page).toContain('Start this focus')
    expect(page).toContain('href={playerPathLevelUpHref}')
    expect(page).toContain('/player-profile/journey-hero.png')
    expect(page).not.toContain('/player-profile/player-id-court.png')
    expect(styles).toMatch(/\.playerFocusVisual\s*\{[\s\S]*?min-height:\s*148px/)
    expect(styles).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.playerFocusProof,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
  })

  it('uses phone-first season cards and explains the Player upgrade without a large interruption', () => {
    expect(page).toContain('isMobile ? (')
    expect(page).toContain('seasonMobileListStyle')
    expect(page).toContain('Player access unlocks saved Player ID reads, matchup prep, and My Lab.')
    expect(styles).toContain('.playerAccessHint')
  })

  it('surfaces recent scorecards as large phone-first cards before the deeper profile reads', () => {
    expect(page).toContain('aria-label="Recent form preview"')
    expect(page).toContain('Latest scorecards')
    expect(page).toContain('Open match history')
    expect(page.indexOf('mobileResultsPreview')).toBeLessThan(page.indexOf('id="profile-player-id"'))
    expect(styles).toContain('.mobileResultsPreviewGrid')
    expect(styles).toContain(".mobileResultPreviewCard[data-result='W']")
  })
})
