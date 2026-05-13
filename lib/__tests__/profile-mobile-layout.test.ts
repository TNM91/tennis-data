import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Profile mobile layout guards', () => {
  it('keeps profile hero, setup, and form grids minmax-safe on mobile', () => {
    expect(source).not.toContain("? '1fr'")
    expect(source).not.toContain("whiteSpace: 'nowrap'")

    for (const styleName of [
      'heroStyle',
      'toolFlowCardStyle',
      'contentGridStyle',
      'setupStepGridStyle',
      'formGridStyle',
      'identityGridStyle',
      'autoContextCalloutStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minmax(0, 1fr)')
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
  })

  it('keeps profile shells, rows, and controls wrap-safe', () => {
    for (const styleName of [
      'pageStyle',
      'toolFlowStyle',
      'heroButtonRowStyle',
      'statusPanelStyle',
      'profileBadgeRowStyle',
      'playerCardTopStyle',
      'miniGridStyle',
      'setupPathStyle',
      'surfaceStyle',
      'sectionHeaderStyle',
      'autoContextStripStyle',
      'fieldStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    for (const styleName of [
      'eyebrowStyle',
      'heroTitleStyle',
      'heroTextStyle',
      'primaryButtonStyle',
      'secondaryButtonStyle',
      'setupPathTitleStyle',
      'setupStepLabelStyle',
      'sectionTitleStyle',
      'labelStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('setupStepTopStyle')).toContain("flexWrap: 'wrap'")
  })
})
