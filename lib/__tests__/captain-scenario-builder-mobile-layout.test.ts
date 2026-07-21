import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/scenario-builder/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

function functionBlock(functionName: string) {
  const start = source.indexOf(`function ${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextFunction = source.indexOf('\nfunction ', start + 1)
  const nextConst = source.indexOf('\nconst ', start + 1)
  const end = [nextFunction, nextConst].filter((index) => index > start).sort((a, b) => a - b)[0]
  return source.slice(start, end === undefined ? undefined : end)
}

describe('Captain scenario builder mobile layout guards', () => {
  it('keeps hero, workflow, shells, and responsive grid factories mobile-safe', () => {
    for (const styleName of [
      'pageContentStyle',
      'toolControlShell',
      'toolControlHeaderStyle',
      'toolControlButtonRowStyle',
      'compactPillRowStyle',
      'captainReadCard',
      'contentWrap',
      'surfaceCardStrong',
      'surfaceCard',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('toolControlShellResponsive')).toContain('minWidth: 0')
    expect(functionBlock('toolControlShellResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('compareGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('compareGridResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('projectionGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('projectionGridResponsive')).toContain("? 'minmax(0, 1fr)'")
    expect(functionBlock('notesGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('notesGridResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(source).not.toContain("? '1fr'")
    expect(styleBlock('toolControlTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("{!isMobile ? <CaptainSuitePanel active=\"scenario\" teamLabel={teamFilter || 'Team week'} /> : null}")
    expect(source.indexOf('toolControlShellResponsive(isTablet, isMobile)')).toBeLessThan(
      source.indexOf('contentWrap'),
    )
  })

  it('keeps verdict, compare panels, filters, form controls, and tables resilient', () => {
    for (const styleName of [
      'detailsSummaryStyle',
      'verdictCardStyle',
      'verdictMainStyle',
      'verdictMetricGridStyle',
      'verdictMetricStyle',
      'deepDiveShellStyle',
      'filtersGridStyle',
      'filterFooterStyle',
      'compareGridStyle',
      'projectionGridStyle',
      'notesGridStyle',
      'panelTopStyle',
      'metaGridStylePanel',
      'metaCardStyle',
      'actionRowStyle',
      'inputStyle',
      'primaryButton',
      'ghostButton',
      'pillRowStyle',
      'badgeBase',
      'tableHeaderStyle',
      'tableWrapStyle',
      'tableStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('primaryButton')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('ghostButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('tableWrapStyle')).toContain("overscrollBehaviorX: 'contain'")
    expect(styleBlock('tableWrapStyle')).toContain("WebkitOverflowScrolling: 'touch'")
    expect(styleBlock('tableWrapStyle')).toContain("scrollbarWidth: 'thin'")
    expect(styleBlock('tableWrapStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('notesTextStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('tdStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps scenario analysis grids and cards mobile-safe', () => {
    for (const styleName of [
      'finalizeGridStyle',
      'finalizeCardStyle',
      'takeawayGridStyle',
      'takeawayCardStyle',
      'scenarioCommandGridStyle',
      'scenarioCommandCardStyle',
      'deltaSummaryGridStyle',
      'deltaSummaryCardStyle',
      'readinessGridStyle',
      'readinessCardStyle',
      'confidenceLadderGridStyle',
      'confidenceLadderCardStyle',
      'scoreboardGridStyle',
      'scoreboardCardStyle',
      'changeDigestGridStyle',
      'changeDigestCardStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('finalizeLabelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('finalizeValueStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('finalizeTextStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
