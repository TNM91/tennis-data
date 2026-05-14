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
      'matchPlanTextStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('tiqActionLabelStyle')).toContain("whiteSpace: 'normal'")
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
      'summaryGridStyle',
      'collectionsStackStyle',
      'manageFollowsHeaderStyle',
      'summaryCardStyle',
      'insightStackStyle',
      'insightCardStyle',
      'followListStyle',
      'followCardStyle',
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
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('feedTopRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('followCardStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('tabButtonStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('feedLinkStyle')).toContain("maxWidth: '100%'")
  })
})
