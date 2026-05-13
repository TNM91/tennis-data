import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const matchupSource = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const match = matchupSource.match(new RegExp(`const ${styleName}: CSSProperties = \\{[\\s\\S]*?\\n\\}`))
  expect(match, `${styleName} style block`).not.toBeNull()
  return match![0]
}

function functionBlock(functionName: string) {
  const typedStart = matchupSource.indexOf(`const ${functionName}:`)
  const untypedStart = matchupSource.indexOf(`const ${functionName} =`)
  const start = typedStart >= 0 ? typedStart : untypedStart
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = matchupSource.indexOf('\nconst ', start + 1)
  return matchupSource.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('matchup mobile layout guards', () => {
  it('collapses dense setup and comparison rows on narrow screens', () => {
    expect(matchupSource).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(matchupSource).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(matchupSource).toContain('const dynamicIdentitySetupStripStyle: CSSProperties')
    expect(matchupSource).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)'")
    expect(matchupSource).toContain("gridTemplateColumns: isSmallMobile")
    expect(matchupSource).toContain("? 'minmax(0, 1fr)'")
    expect(matchupSource).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))'")
    expect(matchupSource).toContain('const compareHeadCopyStyle: CSSProperties')
    expect(matchupSource).toContain("flexWrap: 'wrap',")
    expect(matchupSource).toContain("flex: '1 1 150px'")
    expect(matchupSource).toContain("flex: '0 1 90px'")
    expect(matchupSource).not.toContain("minWidth: '90px'")
    expect(styleBlock('contentWrap')).toContain('minWidth: 0')
    expect(functionBlock('dynamicHeroContent')).toContain("isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('dynamicCompareGrid')).toContain("isTablet ? 'minmax(0, 1fr)'")
  })

  it('keeps long matchup names and head-to-head rows from forcing overflow', () => {
    expect(matchupSource).toContain('const swapSidesRowStyle: CSSProperties')
    expect(matchupSource).toContain('const trajectoryPanelStyle: CSSProperties')
    expect(matchupSource).toContain('const headToHeadMatchRowStyle: CSSProperties')
    expect(matchupSource).toContain("function headToHeadWinnerPillStyle(winner: 'A' | 'B'): CSSProperties")
    expect(matchupSource).toContain("overflowWrap: 'anywhere'")
    expect(matchupSource).toContain("maxWidth: '100%'")
    expect(matchupSource).not.toContain("whiteSpace: 'nowrap'")
  })

  it('keeps Matchup support grids and labels from expanding past the shell', () => {
    ;[
      'selectorGrid',
      'editorialPanel',
      'editorialGrid',
      'handoffSidesGridStyle',
      'doublesPreviewGridStyle',
      'suggestionGrid',
      'prepReadGrid',
      'ratingGrid',
      'metricGrid',
    ].forEach((styleName) => {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    })

    ;[
      'toolHeaderKickerStyle',
      'toolHeaderTitleStyle',
      'identitySetupKickerStyle',
      'inputLabel',
      'editorialCardLabel',
      'handoffKickerStyle',
      'handoffSideLabelStyle',
      'doublesPreviewLabelStyle',
      'formCompareLabel',
      'formCellLabel',
    ].forEach((styleName) => {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    })

    expect(styleBlock('toolHeaderTitleClusterStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('handoffTitleClusterStyle')).toContain("flexWrap: 'wrap'")
  })
})
