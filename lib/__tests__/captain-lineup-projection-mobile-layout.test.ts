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
      'headerStyle',
      'headerInner',
      'navStyle',
      'heroShell',
      'heroButtonRowStyle',
      'heroMetricGridBaseStyle',
      'heroMetricCardStyle',
      'quickStartCard',
      'workflowListStyle',
      'workflowRowStyle',
      'contentWrap',
      'surfaceCardStrong',
      'surfaceCard',
      'surfaceCardStrongInset',
      'sectionHeaderStyle',
      'filterGridStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('heroShellResponsive')).toContain('minWidth: 0')
    expect(functionBlock('navStyleResponsive')).toContain('minWidth: 0')
    expect(styleBlock('navLink')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('heroTitleStyle')).toContain("overflowWrap: 'anywhere'")
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
    expect(functionBlock('rosterGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('listRowResponsive')).toContain('minWidth: 0')
    expect(styleBlock('listRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('badgeBase')).toContain("whiteSpace: 'normal'")
  })

  it('keeps dense ranking rows and the footer mobile-safe', () => {
    expect(source).toContain("gap: 8, flexWrap: 'wrap', minWidth: 0")

    for (const styleName of [
      'footerStyle',
      'footerInner',
      'footerRow',
      'footerBrandLink',
      'footerLinks',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('footerRowResponsive')).toContain('minWidth: 0')
    expect(functionBlock('footerLinksResponsive')).toContain('minWidth: 0')
    expect(styleBlock('footerBottom')).toContain("overflowWrap: 'anywhere'")
  })
})
