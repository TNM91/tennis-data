import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain lineup builder mobile layout guards', () => {
  it('keeps the hero, form shells, and workflow rows from forcing mobile overflow', () => {
    for (const styleName of [
      'pageWrap',
      'builderControlShellStyle',
      'builderControlHeaderStyle',
      'builderControlRowStyle',
      'builderLayoutResponsive',
      'columnStyle',
      'surfaceCardStrong',
      'surfaceCard',
      'sectionHeaderStyle',
      'filtersGridStyle',
      'contextSummaryGridStyle',
      'sharedNotesCardStyle',
      'actionRowStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('builderControlShellStyle')).toContain('minWidth: 0')
    expect(styleBlock('builderControlRowStyle')).toContain("gridTemplateColumns: isSmallMobile")
    expect(styleBlock('builderControlRowStyle')).toContain("? 'minmax(0, 1fr)'")
    expect(styleBlock('builderLayoutResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('builderLayoutResponsive')).toContain("'repeat(3, minmax(0, 1fr))'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '1fr'")
    expect(source).not.toContain("gridTemplateColumns: '42px minmax(0, 1fr)'")
    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('primaryButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('ghostButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('ghostButtonSmallButton')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps saved scenarios, slot editors, and lineup rows mobile-safe', () => {
    for (const styleName of [
      'stackStyle',
      'stackStyleCompact',
      'listCardStyle',
      'listCardStyleCompact',
      'slotCardStyle',
      'slotHeaderStyle',
      'slotHeaderLeftStyle',
      'slotPlayersGridStyle',
      'slotPlayerRowStyle',
      'tableHeaderStyle',
      'detailsSummaryStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('listCardStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('listCardStyleCompact')).toContain("flexWrap: 'wrap'")
    expect(source).toContain("gap: 8, flexWrap: 'wrap', minWidth: 0")
    expect(source).toContain("style={{ minWidth: 0, overflowWrap: 'anywhere' }}")
    expect(styleBlock('slotLabelInputStyle')).toContain("width: 'min(100%, 180px)'")
    expect(styleBlock('slotLabelInputStyle')).toContain('minWidth: 0')
  })

  it('keeps decision, projection, and lock panels resilient on narrow screens', () => {
    for (const styleName of [
      'decisionSnapshotGridStyle',
      'decisionBoardShellStyle',
      'decisionBoardHeaderStyle',
      'decisionBoardGridStyle',
      'decisionHeroCardStyle',
      'decisionCompactCardStyle',
      'decisionBoardActionRowStyle',
      'decisionCardBaseStyle',
      'actionPlanGridStyle',
      'decisionQueueGridStyle',
      'scenarioDeckGridStyle',
      'scenarioDeckCardStyle',
      'scenarioDeckButtonRowStyle',
      'projectionHeroStyle',
      'pillRowStyle',
      'miniPillStyle',
      'heroBadgeRowStyleCompact',
      'lockPanelStyle',
      'lockGridStyle',
      'lockSummaryCardStyle',
      'rightPillStackStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('miniPillStyle')).toContain("whiteSpace: 'normal'")
    for (const styleName of [
      'decisionSnapshotGridStyle',
      'actionPlanGridStyle',
      'decisionQueueGridStyle',
      'scenarioDeckGridStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    }
    expect(styleBlock('bannerBlueStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('bannerGreenStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('warningCardStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
