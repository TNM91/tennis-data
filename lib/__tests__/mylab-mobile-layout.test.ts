import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('My Lab mobile layout guards', () => {
  it('keeps TIQ action and team prep rails mobile-safe', () => {
    for (const styleName of [
      'tiqActionRailStyle',
      'tiqActionGridStyle',
      'tiqActionCardStyle',
      'tiqActionTopRowStyle',
      'tiqActionButtonRowStyle',
      'teamPrepRailStyle',
      'teamPrepGridStyle',
      'teamPrepCardStyle',
      'teamPrepActionRowStyle',
      'levelMeterHeaderStyle',
      'levelRatingBlockStyle',
      'levelMeterMetaStyle',
      'levelMeterScaleStyle',
      'matchPlanPanelStyle',
      'matchPlanGridStyle',
      'matchPlanCardStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }

    for (const styleName of [
      'tiqActionLabelStyle',
      'tiqActionMetaStyle',
      'tiqActionTitleStyle',
      'tiqActionTextStyle',
      'smallInlineLinkStyle',
      'teamPrepTitleStyle',
      'teamPrepMetaStyle',
      'levelMeterTitleStyle',
      'levelRatingBlockStyle',
      'levelMeterMetaStyle',
      'matchPlanTextStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('tiqActionLabelStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('levelMeterScaleStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('smallInlineLinkStyle')).toContain("maxWidth: '100%'")
  })

  it('keeps My Lab filters, feed, and follow cards from forcing horizontal overflow', () => {
    for (const styleName of [
      'filterRowStyle',
      'searchResultsStyle',
      'searchResultItemStyle',
      'feedListStyle',
      'feedCardStyle',
      'feedTopRowStyle',
      'feedMetaRowStyle',
      'sectionHeaderCopyStyle',
      'summaryGridStyle',
      'collectionsStackStyle',
      'manageFollowsHeaderStyle',
      'summaryCardStyle',
      'insightStackStyle',
      'insightCardStyle',
      'followListStyle',
      'followCardStyle',
      'performanceCardStyle',
      'matchupQueueCardStyle',
      'workshopMatchRowStyle',
      'nextActionCardStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }

    for (const styleName of [
      'tabButtonStyle',
      'searchResultItemStyle',
      'searchResultTitleStyle',
      'searchResultMetaStyle',
      'feedCardStyle',
      'feedTimeStyle',
      'feedTitleStyle',
      'feedBodyStyle',
      'feedLinkStyle',
      'pillSlateStyle',
      'supportTitleStyle',
      'supportTextStyle',
      'summaryValueStyle',
      'insightCardStyle',
      'insightTitleStyle',
      'insightTextStyle',
      'followNameStyle',
      'followMetaStyle',
      'matchupQueueCardStyle',
      'workshopMatchRowStyle',
      'nextActionCardStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('feedTopRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('sectionHeaderCopyStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('sectionHeaderCopyStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('followCardStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('tabButtonStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('feedLinkStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('performanceCardStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 64px) minmax(0, 1fr)'",
    )
    expect(source).not.toContain("gridTemplateColumns: '64px minmax(0, 1fr)'")
    for (const styleName of ['matchupQueueCardStyle', 'workshopMatchRowStyle', 'nextActionCardStyle']) {
      expect(styleBlock(styleName), styleName).toContain("'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)'")
      expect(styleBlock(styleName), styleName).not.toContain("'auto minmax(0, 1fr) auto'")
    }
  })
})
