import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8')

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

describe('Captain messaging mobile layout guards', () => {
  it('keeps hero, workflow, and command surfaces mobile-safe', () => {
    for (const styleName of [
      'pageContentStyle',
      'heroShell',
      'heroButtonRowStyle',
      'heroStatusShell',
      'heroStatusButtonRow',
      'heroMetricGridBaseStyle',
      'heroMetricCardStyle',
      'quickStartCard',
      'workflowListStyle',
      'workflowRowStyle',
      'contentWrap',
      'surfaceCardStrong',
      'surfaceCard',
      'teamRoomSurfaceStyle',
      'messagePlaybookSurfaceStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('heroShellResponsive')).toContain('minWidth: 0')
    expect(functionBlock('heroShellResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('heroMetricGridStyle')).toContain('minWidth: 0')
    expect(functionBlock('heroMetricGridStyle')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(functionBlock('twoColumnGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('twoColumnGridResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(styleBlock('heroTitleStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps playbook, handoff, composer, and form controls from forcing overflow', () => {
    for (const styleName of [
      'messagePlaybookGridStyle',
      'messagePlaybookCardStyle',
      'teamRoomGridStyle',
      'teamRoomStepStyle',
      'builderHandoffGridStyle',
      'builderHandoffCardBaseStyle',
      'filtersGridStyle',
      'statsGridStyle',
      'miniMetricCardStyle',
      'inputStyle',
      'textareaStyle',
      'composerPreviewStyle',
      'composerPreviewTopStyle',
      'composerPreviewGridStyle',
      'composerPreviewMetricStyle',
      'primaryButton',
      'ghostButton',
      'badgeBase',
      'pillRowStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('primaryButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('ghostButton')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('composerBodyPreviewStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps tables, recipient controls, lineup cards, templates, and repeated grids mobile-safe', () => {
    for (const styleName of [
      'tableHeaderStyle',
      'detailsSummaryStyle',
      'tableWrapStyle',
      'rowControlWrapStyle',
      'statusButtonStyle',
      'lineupStackStyle',
      'lineupCardStyle',
      'lineupHeaderStyle',
      'lineupPlayersGrid',
      'recipientChooserStyle',
      'checkboxGridStyle',
      'checkboxRowStyle',
      'actionRowStyle',
      'templateGridStyle',
      'templateCardStyle',
      'intelligenceGridStyle',
      'intelligenceCardStyle',
      'blockingListStyle',
      'blockingCardStyle',
      'recipientIntelligenceGridStyle',
      'sendStrategyGridStyle',
      'weeklyCommandGridStyle',
      'actionQueueGridStyle',
      'executionChecklistGridStyle',
      'outcomePlannerGridStyle',
      'sequencePlannerGridStyle',
      'launchSnapshotGridStyle',
      'sendConfidenceGridStyle',
      'sendGateGridStyle',
      'riskRadarGridStyle',
      'deliveryReadinessGridStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('lineupHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('lineupPlayersGrid')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('statusButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('templateBodyStyle')).toContain("overflowWrap: 'anywhere'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
  })
})
