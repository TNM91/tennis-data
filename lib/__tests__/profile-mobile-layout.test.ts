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
      'photoControlStyle',
      'inputStyle',
      'actionRowStyle',
      'teamContextListStyle',
      'teamContextRowStyle',
      'ratingTileGridStyle',
      'ratingTileStyle',
      'toolLaunchGridStyle',
      'toolLaunchCardStyle',
      'toolLaunchCardMainStyle',
      'summaryActionRowStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    for (const styleName of [
      'eyebrowStyle',
      'heroTitleStyle',
      'heroTextStyle',
      'toolFlowLabelStyle',
      'toolFlowValueStyle',
      'toolFlowNoteStyle',
      'billingMessageStyle',
      'primaryButtonStyle',
      'secondaryButtonStyle',
      'profileBadgeRowStyle',
      'photoControlStyle',
      'photoInputStyle',
      'photoMessageStyle',
      'metricLabelStyle',
      'metricValueStyle',
      'sectionKickerStyle',
      'pillGreenStyle',
      'setupPathTitleStyle',
      'setupStepLabelStyle',
      'sectionTitleStyle',
      'labelStyle',
      'hintStyle',
      'teamContextRowStyle',
      'successStyle',
      'errorStyle',
      'toolLaunchKickerStyle',
      'toolLaunchValueStyle',
      'toolLaunchNoteStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('setupStepTopStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamContextRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('toolFlowStyle')).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock('toolFlowStyle')).toContain("repeat(auto-fit, minmax(min(100%, 180px), 1fr))")
    expect(styleBlock('miniGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 116px), 1fr))")
    expect(styleBlock('autoContextStripStyle')).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock('autoContextStripStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('ratingTileGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 150px), 1fr))")
    expect(styleBlock('pillGreenStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('pillGreenStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('setupProgressStyle')).toContain("minWidth: 'min(100%, 96px)'")
    expect(styleBlock('setupProgressStyle')).toContain("maxWidth: '100%'")
    expect(source).not.toContain('minWidth: 96')
    expect(source).not.toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
  })
})
