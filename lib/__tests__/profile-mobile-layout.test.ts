import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Profile mobile layout guards', () => {
  it('keeps profile hero, setup, and form grids minmax-safe on mobile', () => {
    expect(source).not.toContain("? '1fr'")
    expect(source).not.toContain("whiteSpace: 'nowrap'")

    for (const styleName of [
      'profileIntroStyle',
      'contentGridStyle',
      'formGridStyle',
      'identityGridStyle',
      'autoContextStripStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minmax(0, 1fr)')
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
  })

  it('keeps profile shells, rows, and controls wrap-safe', () => {
    for (const styleName of [
      'pageStyle',
      'profileIntroStyle',
      'profileIntroCopyStyle',
      'profileIntroActionsStyle',
      'surfaceStyle',
      'sectionHeaderStyle',
      'autoContextStripStyle',
      'fieldStyle',
      'inputStyle',
      'actionRowStyle',
      'teamContextListStyle',
      'teamContextRowStyle',
      'ratingTileGridStyle',
      'ratingTileStyle',
      'profileAwardStripStyle',
      'profileAwardHeaderStyle',
      'profileAwardPillRowStyle',
      'profileAwardProofGridStyle',
      'profileAwardProofItemStyle',
      'newPlayerPathStyle',
      'newPlayerPathHeaderStyle',
      'newPlayerActionGridStyle',
      'newPlayerActionCardStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    for (const styleName of [
      'heroTitleStyle',
      'heroTextStyle',
      'billingMessageStyle',
      'primaryButtonStyle',
      'secondaryButtonStyle',
      'metricLabelStyle',
      'metricValueStyle',
      'profileLoadingNoticeStyle',
      'sectionTitleStyle',
      'sectionTextStyle',
      'labelStyle',
      'hintStyle',
      'teamContextRowStyle',
      'successStyle',
      'errorStyle',
      'profileAwardPillStyle',
      'profileAwardLinkStyle',
      'newPlayerPathStyle',
      'newPlayerPathHeaderStyle',
      'newPlayerActionCardStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamContextRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('profileIntroActionsStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('profileIntroStyle')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('autoContextStripStyle')).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock('autoContextStripStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('ratingTileGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('newPlayerActionGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    for (const styleName of ['newPlayerPathHeaderStyle', 'newPlayerActionCardStyle']) {
      expect(styleBlock(styleName)).toContain("'minmax(0, auto) minmax(0, 1fr)'")
    }
    expect(source).not.toContain('minWidth: 96')
    expect(source).not.toContain("minWidth: 'min(100%, 96px)'")
    expect(source).not.toContain("'auto minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
  })
})
