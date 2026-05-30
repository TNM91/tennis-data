import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-availability/page.tsx'), 'utf8')

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

describe('Captain lineup availability mobile layout guards', () => {
  it('keeps header, hero, workflow, and filter shells mobile-safe', () => {
    for (const styleName of [
      'pageStyle',
      'toolControlShell',
      'toolControlHeaderStyle',
      'toolControlButtonRowStyle',
      'heroMetricCardStyle',
      'captainReadCard',
      'contentWrap',
      'surfaceCardStrong',
      'surfaceCard',
      'sectionHeaderStyle',
      'filtersGridStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('toolControlShellResponsive')).toContain('minWidth: 0')
    expect(functionBlock('toolControlShellResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('metricsGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('filtersGridResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('orbOne')).toContain("width: 'min(100%, 360px)'")
    expect(styleBlock('orbTwo')).toContain("width: 'min(100%, 320px)'")
    expect(styleBlock('toolControlTitleStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps metrics, readiness panels, pills, and bulk actions from forcing overflow', () => {
    for (const styleName of [
      'heroBadgeRowStyleCompact',
      'miniPillSlate',
      'miniPillBlue',
      'pillRowStyle',
      'availabilityMetricsStyle',
      'readinessGridStyle',
      'readinessCardStyle',
      'readinessCardTopStyle',
      'bulkActionsWrapStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('metricsGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('metricsGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('readinessGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('readinessGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('getAvailStatusStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('miniPillSlate')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('noticeStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps roster cards, status controls, inputs, and footer mobile-safe', () => {
    for (const styleName of [
      'rosterGridStyle',
      'playerTopStyle',
      'ratingsStackStyle',
      'statusGridStyle',
      'statusButtonStyle',
      'textareaStyle',
      'saveFooterStyle',
      'primaryButton',
      'ghostButton',
      'inputStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('rosterGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('rosterGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('statusGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('statusGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(source).not.toContain("width: '360px'")
    expect(source).not.toContain("width: '320px'")
    expect(styleBlock('playerTopStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('statusButtonStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
