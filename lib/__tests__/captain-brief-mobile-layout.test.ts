import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamBriefSource = readFileSync(join(process.cwd(), 'app/captain/team-brief/page.tsx'), 'utf8')
const weeklyBriefSource = readFileSync(join(process.cwd(), 'app/captain/weekly-brief/page.tsx'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const typedStart = source.indexOf(`const ${styleName}:`)
  const functionStart = source.indexOf(`const ${styleName} =`)
  const start = typedStart >= 0 ? typedStart : functionStart
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain brief mobile layout guards', () => {
  it('keeps Team Brief shells, signals, and actions from forcing mobile overflow', () => {
    for (const styleName of [
      'contentStyle',
      'heroCard',
      'heroTopRow',
      'signalCardStyle',
      'metricCard',
      'surfaceCard',
      'sectionHeaderStyle',
      'lineupCard',
      'quickActionRow',
    ]) {
      expect(styleBlock(teamBriefSource, styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock(teamBriefSource, 'heroTitle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamBriefSource, 'twoColumnGrid')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock(teamBriefSource, 'twoColumnGrid')).toContain('minWidth: 0')
    expect(styleBlock(teamBriefSource, 'lineupGrid')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock(teamBriefSource, 'lineupGrid')).toContain('minWidth: 0')
    expect(teamBriefSource).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(teamBriefSource).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(styleBlock(teamBriefSource, 'pillStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(teamBriefSource, 'primaryButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamBriefSource, 'secondaryButton')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps Weekly Brief boards, cards, and actions mobile-safe', () => {
    for (const styleName of [
      'contentStyle',
      'heroCard',
      'briefBoardStyle',
      'briefSignalCardStyle',
      'surfaceCard',
      'notesStack',
      'lineupCard',
      'readinessBaseCard',
      'actionRow',
    ]) {
      expect(styleBlock(weeklyBriefSource, styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock(weeklyBriefSource, 'briefSignalTopStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(weeklyBriefSource, 'twoColumnGrid')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock(weeklyBriefSource, 'twoColumnGrid')).toContain('minWidth: 0')
    expect(styleBlock(weeklyBriefSource, 'lineupGrid')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock(weeklyBriefSource, 'lineupGrid')).toContain('minWidth: 0')
    expect(weeklyBriefSource).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(weeklyBriefSource).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(styleBlock(weeklyBriefSource, 'courtPill')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(weeklyBriefSource, 'primaryButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(weeklyBriefSource, 'secondaryButton')).toContain("overflowWrap: 'anywhere'")
  })
})
