import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamSource = readFileSync(join(process.cwd(), 'app/components/team-league-results-workspace.tsx'), 'utf8')
const individualSource = readFileSync(join(process.cwd(), 'app/components/individual-league-results-workspace.tsx'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('League result workspace mobile layout guards', () => {
  it('keeps team result entry forms and scorekeeper cards mobile-safe', () => {
    for (const styleName of [
      'pageWrap',
      'introCard',
      'card',
      'row',
      'fieldWrap',
      'inputStyle',
      'lineGrid',
      'lineCard',
      'scorekeeperGrid',
      'scorekeeperTile',
      'flowStrip',
      'flowStep',
      'actionRow',
      'detailsCard',
      'detailsSummary',
      'readinessPanel',
      'readinessGrid',
      'readinessItem',
    ]) {
      expect(styleBlock(teamSource, styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock(teamSource, 'flowStep')).toContain("gridTemplateColumns: '32px minmax(0, 1fr)'")
    expect(styleBlock(teamSource, 'btnPrimary')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamSource, 'btnPrimary')).toContain("color: 'var(--foreground-strong)'")
    expect(styleBlock(teamSource, 'btnPrimary')).toContain('color-mix(in srgb, var(--brand-green)')
    expect(styleBlock(teamSource, 'lineCard')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamSource, 'scorekeeperTile')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(teamSource, 'pill')).toContain("whiteSpace: 'normal'")
    expect(teamSource).toContain("gap: 8, marginTop: 8, flexWrap: 'wrap', minWidth: 0")
    expect(teamSource).not.toContain("color: '#0a0a0a'")
  })

  it('keeps individual result forms, standings, and review cards mobile-safe', () => {
    for (const styleName of [
      'pageWrap',
      'introCard',
      'card',
      'detailsCard',
      'detailsSummary',
      'row',
      'fieldWrap',
      'inputStyle',
      'scorekeeperGrid',
      'scorekeeperTile',
      'flowStrip',
      'flowStep',
      'readinessPanel',
      'readinessGrid',
      'readinessItem',
      'listWrap',
      'resultCard',
      'actionRow',
      'insightGrid',
      'standingsList',
      'standingRow',
      'metricStack',
      'reviewToolbar',
    ]) {
      expect(styleBlock(individualSource, styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock(individualSource, 'flowStep')).toContain("gridTemplateColumns: '32px minmax(0, 1fr)'")
    expect(styleBlock(individualSource, 'standingRow')).toContain("'minmax(0, 32px) minmax(0, 1fr) minmax(0, auto)'")
    expect(styleBlock(individualSource, 'standingRow')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'btnPrimary')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'btnPrimary')).toContain("color: 'var(--foreground-strong)'")
    expect(styleBlock(individualSource, 'scorekeeperTile')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'btnSecondary')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(individualSource, 'resultCard')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'resultTitle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(individualSource, 'metricStack')).toContain("overflowWrap: 'anywhere'")
    expect(individualSource).not.toContain("'32px minmax(0, 1fr) auto'")
    expect(individualSource).not.toContain("color: '#0a0a0a'")
  })
})
