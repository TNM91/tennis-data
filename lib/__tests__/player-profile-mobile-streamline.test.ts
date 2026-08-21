import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/players/[id]/player-profile-story.module.css'), 'utf8')

describe('player profile mobile streamline', () => {
  it('puts one public results path ahead of personal tooling', () => {
    expect(page).toContain("const heroSecondaryHref = '#profile-matches'")
    expect(page).toContain("const heroSecondaryLabel = isPublicExplorerProfile ? 'View results'")
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
    expect(page).toContain('{hasPersonalPlayerExperience ? (\n        <section id="profile-player-id"')
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
    expect(page).toContain("const heroSecondaryLabel = isPublicExplorerProfile ? 'View results'")
    expect(page).toContain("data-public-profile={isPublicExplorerProfile}")
    expect(page).toContain("'Compare players'")
    expect(styles).toContain(".storyHero[data-public-profile='true'] .storyContent")
  })
})
