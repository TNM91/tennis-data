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
  const declarationStart = matchupSource.indexOf(`function ${functionName}`)
  const start = typedStart >= 0 ? typedStart : untypedStart >= 0 ? untypedStart : declarationStart
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
    expect(styleBlock('identitySetupStripStyle')).toContain("'minmax(0, 3.5rem) minmax(0, 1fr) minmax(0, 10rem)'")
    expect(styleBlock('identitySetupStripStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('identitySetupStripStyle')).not.toContain(' auto')
    expect(matchupSource).toContain("gridTemplateColumns: isSmallMobile")
    expect(matchupSource).toContain("? 'minmax(0, 1fr)'")
    expect(matchupSource).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))'")
    expect(matchupSource).toContain('const compareHeadCopyStyle: CSSProperties')
    expect(matchupSource).toContain("flexWrap: 'wrap',")
    expect(matchupSource).toContain("flex: '1 1 150px'")
    expect(matchupSource).toContain("flex: '0 1 90px'")
    expect(matchupSource).not.toContain("minWidth: '90px'")
    expect(styleBlock('contentWrap')).toContain('minWidth: 0')
    expect(styleBlock('heroWrap')).toContain('minWidth: 0')
    expect(styleBlock('engineCard')).toContain('minWidth: 0')
    expect(functionBlock('dynamicHeroContent')).toContain("isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('dynamicCompareGrid')).toContain('gridTemplateColumns: isTablet')
    expect(functionBlock('dynamicCompareGrid')).toContain("? 'minmax(0, 1fr)'")
    expect(functionBlock('dynamicCompareGrid')).toContain("minmax(min(100%, 180px), 220px)")
    expect(functionBlock('dynamicCompareGrid')).not.toContain("'minmax(0, 1fr) 220px minmax(0, 1fr)'")
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
      'editorialCard',
      'handoffSidesGridStyle',
      'handoffCardStyle',
      'handoffSideCardStyle',
      'doublesQuickStartStyle',
      'doublesPreviewGridStyle',
      'doublesPreviewCardStyle',
      'suggestionGrid',
      'prefillPromptCard',
      'prepReadGrid',
      'compareGrid',
      'ratingGrid',
      'metricGrid',
      'recommendationCard',
      'emptyHeadToHeadActions',
    ].forEach((styleName) => {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    })

    ;[
      'toolHeaderKickerStyle',
      'headerCopyStyle',
      'toolHeaderTitleStyle',
      'toolHeaderTextStyle',
      'identitySetupKickerStyle',
      'inputLabel',
      'errorTitleStyle',
      'editorialText',
      'editorialCard',
      'editorialCardLabel',
      'editorialCardValue',
      'handoffKickerStyle',
      'handoffCardStyle',
      'handoffSideCardStyle',
      'handoffSideLabelStyle',
      'doublesQuickStartStyle',
      'doublesPreviewCardStyle',
      'doublesPreviewLabelStyle',
      'prefillPromptCard',
      'formCompareLabel',
      'formCellLabel',
      'engineLabel',
      'engineValue',
      'engineText',
      'editorialCardText',
      'emptyStateTitle',
      'emptyStateText',
      'emptyStateHint',
      'selectionProgressLabel',
      'prefillPromptKicker',
      'decisionLabel',
      'prepReadLabel',
      'highlightLabel',
      'gapLabel',
      'sectionKicker',
      'recommendationCard',
      'intelligenceHintLabel',
      'emptyHeadToHeadActions',
    ].forEach((styleName) => {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    })

    expect(styleBlock('profileContextLinkStyle')).toContain('minWidth: 0')
    expect(styleBlock('profileContextLinkStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('emptyState')).toContain('minWidth: 0')
    expect(styleBlock('compareCard')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('centerColumn')).toContain("maxWidth: '100%'")
    expect(styleBlock('gapCard')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('vsBadge')).toContain("flex: '0 0 auto'")
    expect(styleBlock('vsBadge')).toContain("maxWidth: '100%'")
    expect(styleBlock('decisionRight')).toContain("maxWidth: '100%'")
    expect(styleBlock('decisionRight')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('swapSidesRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('trajectoryPanelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('emptyHeadToHeadCard')).toContain("overflowWrap: 'anywhere'")
    expect(functionBlock('headToHeadBarFillStyle')).toContain('var(--brand-green)')
    expect(functionBlock('headToHeadBarFillStyle')).toContain('var(--brand-lime)')
    expect(styleBlock('headToHeadBarRemainderStyle')).toContain('minWidth: 0')
    expect(styleBlock('headToHeadPercentLabelGreenStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('headToHeadTagPillBlueStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('headToHeadMatchDateStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('headToHeadMatchTypeStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('headToHeadQualityPillStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('toolHeaderTitleClusterStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('handoffTitleClusterStyle')).toContain("flexWrap: 'wrap'")
    expect(functionBlock('CopyLinkButton')).toContain("maxWidth: '100%'")
    expect(functionBlock('CopyLinkButton')).toContain("overflowWrap: 'anywhere'")
    expect(functionBlock('SwapSidesButton')).toContain("maxWidth: '100%'")
    expect(functionBlock('SwapSidesButton')).toContain("whiteSpace: 'normal' as const")
    expect(matchupSource).not.toContain("linear-gradient(90deg, #9be11d, #4ade80)")
  })
})
