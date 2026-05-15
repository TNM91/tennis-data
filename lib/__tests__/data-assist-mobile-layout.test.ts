import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Data Assist mobile layout guards', () => {
  it('keeps upload setup panels and import choices from forcing horizontal scroll', () => {
    for (const styleName of [
      'pageStyle',
      'heroStyle',
      'heroCopyStyle',
      'panelStyle',
      'sectionHeaderStyle',
      'typeOptionGridStyle',
      'uploadChoiceStackStyle',
      'seasonSetupGroupStyle',
      'stepDividerStyle',
      'typeOptionStyle',
      'dropzoneStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('heroStyle')).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(styleBlock('heroStyle')).not.toContain("gridTemplateColumns: '1fr'")
    expect(styleBlock('titleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('typeOptionStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('stepDividerStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('fileInputStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('primaryButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('smallButtonStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps saved upload cards, history filters, and badge panels mobile-safe', () => {
    for (const styleName of [
      'submissionListStyle',
      'submissionCardStyle',
      'submissionCardTopStyle',
      'submissionMetaStyle',
      'historyManagementStyle',
      'historyFilterStyle',
      'badgePanelStyle',
      'badgeListStyle',
      'badgeCardStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('historyFilterStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('historyFilterStyle')).toContain("overflowX: 'auto'")
    expect(styleBlock('historyFilterStyle')).toContain("overscrollBehaviorX: 'contain'")
    expect(styleBlock('historyFilterStyle')).toContain("WebkitOverflowScrolling: 'touch'")
    expect(styleBlock('historyFilterStyle')).toContain("scrollbarWidth: 'thin'")
    expect(styleBlock('historyFilterButtonStyle')).toContain("flex: '0 0 auto'")
    expect(styleBlock('historyFilterButtonStyle')).toContain('minWidth: 0')
    expect(styleBlock('historyFilterButtonStyle')).toContain('maxWidth: 180')
    expect(styleBlock('historyFilterButtonStyle')).not.toContain("minWidth: 'min(100%, 92px)'")
    expect(styleBlock('historyFilterButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('badgeCardStyle')).toContain("flex: '1 1 min(100%, 190px)'")
  })

  it('keeps parsed review rows and screenshot cards wrapped on narrow screens', () => {
    for (const styleName of [
      'scorecardReviewStyle',
      'scorecardHeaderGridStyle',
      'parsedLineListStyle',
      'parsedLineStyle',
      'parsedScorecardLineStyle',
      'scheduleMatchRowStyle',
      'bulkResultRowStyle',
      'playerSidesGridStyle',
      'screenshotGridStyle',
      'screenshotCardStyle',
      'thumbnailWrapStyle',
      'exportFilePreviewStyle',
      'screenshotBodyStyle',
      'exportHelpBodyStyle',
    ]) {
      expect(styleBlock(styleName)).toMatch(/minWidth: 0|overflowWrap: 'anywhere'/)
    }

    expect(source).not.toContain("? '1fr'")
    expect(styleBlock('screenshotGridStyle')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('parsedSideHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('exportHelpToggleStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('exportHelpToggleStyle')).toContain('minWidth: 0')
    expect(styleBlock('parsedLineStyle')).toContain("'minmax(0, 1fr) minmax(0, 8rem)'")
    expect(styleBlock('bulkResultRowStyle')).toContain("'minmax(0, 1fr) minmax(0, 8rem)'")
    expect(styleBlock('showMoreButtonStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('scanLoadingStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('screenshotCardStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))'")
    expect(styleBlock('screenshotCardStyle')).not.toContain("minmax(min(38%, 108px), 0.34fr)")
    expect(styleBlock('screenshotBodyStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('exportFilePreviewStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
