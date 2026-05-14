import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')

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

describe('Captain availability mobile layout guards', () => {
  it('keeps the hero and selector controls from forcing mobile overflow', () => {
    for (const styleName of [
      'pageWrap',
      'heroShell',
      'selectorPanel',
      'heroBadgeRow',
      'badgeBase',
      'quickStartCard',
      'statusGrid',
      'statusCard',
      'responseMeterShell',
      'responseMeterTop',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('heroShellResponsive')).toContain('minWidth: 0')
    expect(functionBlock('heroShellResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('selectorPanelResponsive')).toContain('minWidth: 0')
    expect(styleBlock('selectorPanel')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('selectStyle')).toContain("flex: '1 1 min(100%, 220px)'")
    expect(styleBlock('selectStyle')).toContain('minWidth: 0')
    expect(styleBlock('primaryButton')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps decision cards, metrics, sections, and CTAs mobile-safe', () => {
    for (const styleName of [
      'contentWrap',
      'metricGrid',
      'decisionPanel',
      'availabilityActionGrid',
      'availabilityActionCard',
      'availabilityActionTop',
      'metricCard',
      'sectionCard',
      'sectionHead',
      'sectionActions',
      'sectionChipRow',
      'sectionCtaSecondary',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('metricGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('metricGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('availabilityActionGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('availabilityActionGridResponsive')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('sectionHeadResponsive')).toContain('minWidth: 0')
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(styleBlock('sectionCtaSecondary')).toContain("whiteSpace: 'normal'")
  })

  it('keeps player rows, status actions, and loading states resilient on small screens', () => {
    for (const styleName of [
      'playerList',
      'playerRow',
      'statusButtonRow',
      'statusButton',
      'loadingWrap',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('playerRowResponsive')).toContain('minWidth: 0')
    expect(functionBlock('statusButtonRowResponsive')).toContain('minWidth: 0')
    expect(styleBlock('playerRow')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('statusButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('loadingCard')).toContain("overflowWrap: 'anywhere'")
  })
})
