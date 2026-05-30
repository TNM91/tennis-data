import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/analytics/page.tsx'), 'utf8')

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

describe('Captain analytics mobile layout guards', () => {
  it('keeps hero, metrics, and builder grids mobile-safe', () => {
    for (const styleName of [
      'pageWrap',
      'toolControlShell',
      'toolControlHeaderStyle',
      'toolControlButtonRowStyle',
      'captainReadCard',
      'contentWrap',
      'decisionBoardStyle',
      'decisionMetricGridStyle',
      'decisionMetricStyle',
      'builderLayoutStyle',
      'columnStyle',
      'surfaceCardStrong',
      'surfaceCard',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('pageWrap')).toContain("width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))'")
    expect(source).not.toContain("calc(100% - 48px)")
    expect(functionBlock('toolControlShellResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('builderLayoutResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('toolControlTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('signalNoteStyle')).toContain("lineHeight: 1.5")
  })

  it('keeps controls, toggles, cards, and player labels from forcing overflow', () => {
    for (const styleName of [
      'sectionHeaderStyle',
      'formGridStyle',
      'toggleGridStyle',
      'toggleCardStyle',
      'actionRowStyle',
      'readinessGridStyle',
      'readinessCardStyle',
      'miniActionRowStyle',
      'primaryButton',
      'ghostButton',
      'inputStyle',
      'textareaStyle',
      'slotPlayersGridStyle',
      'heroBadgeRowStyleCompact',
      'poolCardStyle',
      'poolCardTopStyle',
      'pillRowStyle',
      'compareGridStyle',
      'compareCardStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('toggleGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock('compareGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('compareLabelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('compareValueStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('slotLabelInputStyle')).toContain("width: 'min(100%, 180px)'")
    expect(styleBlock('slotLabelInputStyle')).toContain('minWidth: 0')
    expect(styleBlock('badgeBase')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('miniPillStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerNameStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerMetaStyle')).toContain("overflowWrap: 'anywhere'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
    expect(source).not.toContain("minWidth: '180px'")
  })
})
