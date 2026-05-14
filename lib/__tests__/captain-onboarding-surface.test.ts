import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const match = new RegExp(`const ${styleName}(?::|\\s*=)`).exec(source)
  expect(match?.index ?? -1, styleName).toBeGreaterThanOrEqual(0)
  const start = match?.index ?? 0
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain onboarding surface', () => {
  it('keeps the first Captain screen progressive and Data Assist aware', () => {
    expect(source).toContain('CAPTAIN_ONBOARDING_STEPS')
    expect(source).toContain('CAPTAIN_TEAM_SCOPE_HANDOFF')
    expect(source).toContain('Choose scope')
    expect(source).toContain('Confirm availability')
    expect(source).toContain('Send the plan')
    expect(source).toContain('Captain starts with your linked profile team when available')
    expect(source).toContain('Profile first')
    expect(source).toContain('Link your player identity in My Lab so Captain can auto-select')
    expect(source).toContain('Roster history')
    expect(source).toContain('Data refresh')
    expect(source).toContain('reviewed Data Assist uploads')
    expect(source).toContain('CAPTAIN_EMPTY_STATE_ACTIONS')
    expect(source).toContain('Captain needs a linked profile team, roster history, or reviewed Data Assist upload')
    expect(source).toContain('Link in My Lab')
  })

  it('keeps Captain onboarding compact on small mobile screens', () => {
    expect(source).toContain('captainOnboardingStripStyle(isSmallMobile)')
    expect(source).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(source).toContain('captainOnboardingStepStyle')
    expect(source).toContain('minmax(0, 1fr)')
    expect(source).toContain('captainScopeHandoffGridStyle(isSmallMobile)')
    expect(source).toContain('captainScopeHandoffCardStyle')
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isMobile ? '1fr'")
    expect(source).toContain("minWidth: 'min(100%, 62px)'")
  })

  it('keeps Captain dashboard decision rows safe for long team and player names', () => {
    expect(source).toContain("gridTemplateColumns: isTablet\n    ? 'minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: isTablet\n    ? '1fr'")

    for (const styleName of [
      'sectionCard',
      'sectionHead',
      'captainDashboardActionBandStyle',
      'captainDashboardInlineActionRowStyle',
      'listCard',
      'pairMetricWrap',
      'commandCenterTopRow',
      'commandCenterActionRow',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }

    for (const styleName of [
      'nextMatchActionLinkStyle',
      'listTitle',
      'listMeta',
      'pillStrong',
      'commandCenterTitle',
      'commandCenterLabel',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }
  })

  it('keeps Captain empty states actionable for missing teams and rosters', () => {
    expect(source).toContain('Choose or connect a team scope.')
    expect(source).toContain('No roster players are available yet.')
    expect(source).toContain('Upload team data')
    expect(source).toContain('Refresh Captain')
    expect(source).toContain('captainEmptyActionRowStyle')
    expect(source).toContain('inlineEmptyLinkStyle')
    expect(source).toContain('inlineEmptyButtonStyle')
  })
})
