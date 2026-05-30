import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-projection/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
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

describe('Captain lineup projection mobile layout guards', () => {
  it('keeps header, hero, workflow, and filter shells mobile-safe', () => {
    for (const styleName of [
      'pageStyle',
      'toolControlShell',
      'toolControlHeaderStyle',
      'toolControlButtonRowStyle',
      'captainReadCard',
      'contentWrap',
      'surfaceCardStrong',
      'surfaceCard',
      'surfaceCardStrongInset',
      'sectionHeaderStyle',
      'filterGridStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('toolControlShellResponsive')).toContain('minWidth: 0')
    expect(functionBlock('toolControlShellResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('filterGridResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('orbOne')).toContain("width: 'min(100%, 360px)'")
    expect(styleBlock('orbTwo')).toContain("width: 'min(100%, 320px)'")
    expect(styleBlock('toolControlTitleStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps projection cards, roster grids, pills, and list rows from forcing overflow', () => {
    for (const styleName of [
      'badgeBase',
      'projectionGridStyle',
      'actionReadGridStyle',
      'actionReadCardStyle',
      'actionReadTopStyle',
      'compareGridStyle',
      'lineItemStyle',
      'notesListStyle',
      'rosterGridStyle',
      'pillRowStyle',
      'miniGridStyle',
      'miniStatStyle',
      'listCardStyle',
      'listRowStyle',
      'primaryButton',
      'ghostButton',
      'inputStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('projectionGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('projectionGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('actionReadGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('compareGridResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('rosterGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('rosterGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('miniGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(source).not.toContain("width: '360px'")
    expect(source).not.toContain("width: '320px'")
    expect(functionBlock('listRowResponsive')).toContain('minWidth: 0')
    expect(styleBlock('listRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('badgeBase')).toContain("whiteSpace: 'normal'")
  })

  it('keeps dense ranking rows and the footer mobile-safe', () => {
    expect(source).toContain("gap: 8, flexWrap: 'wrap', minWidth: 0")

    expect(styleBlock('listCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('listMetaStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
