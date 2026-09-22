import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8').replace(/\r\n/g, '\n')

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
  it('opens a focused contact task instead of burying the requested player', () => {
    expect(source).toContain("const contactReviewMode = searchParams.get('contactView') === 'missing'")
    expect(source).toContain("searchParams.get('missingContacts')")
    expect(source).toContain('open={contactManagerRequested || undefined}')
    expect(source).toContain("document.getElementById('captain-contact-manager')?.scrollIntoView")
    expect(source).toContain("document.getElementById('draft-contact-phone')?.focus()")
    expect(source).toContain('Add the phone number below. After you save it, full-team texts will be ready.')
  })

  it('keeps hero, workflow, and command surfaces mobile-safe', () => {
    for (const styleName of [
      'pageContentStyle',
      'messageControlShell',
      'messageControlHeaderStyle',
      'messageControlButtonRowStyle',
      'heroStatusShell',
      'heroStatusButtonRow',
      'contentWrap',
      'surfaceCardStrong',
      'surfaceCard',
      'messagePlaybookSurfaceStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(functionBlock('messageControlShellResponsive')).toContain('minWidth: 0')
    expect(functionBlock('messageControlShellResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(functionBlock('twoColumnGridResponsive')).toContain('minWidth: 0')
    expect(functionBlock('twoColumnGridResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(styleBlock('messageControlTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("{!isMobile ? <CaptainSuitePanel active=\"messaging\" teamLabel={teamFilter || 'Team week'} /> : null}")
    expect(source).toContain('<PrimaryLink href="#captain-message-composer">Review send</PrimaryLink>')
    expect(source).toContain('const mobileSendPulse = [')
    expect(source).toContain('aria-label="Captain message send pulse"')
    expect(source).toContain('<section id="captain-message-composer" style={surfaceCard}>')
    expect(source.indexOf('messageControlShellResponsive(isTablet, isMobile)')).toBeLessThan(
      source.indexOf('messagePlaybookSurfaceStyle'),
    )
  })

  it('keeps playbook, handoff, composer, and form controls from forcing overflow', () => {
    for (const styleName of [
      'messagePlaybookGridStyle',
      'messagePlaybookCardStyle',
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
    expect(styleBlock('tableWrapStyle')).toContain("overscrollBehaviorX: 'contain'")
    expect(styleBlock('tableWrapStyle')).toContain("WebkitOverflowScrolling: 'touch'")
    expect(styleBlock('tableWrapStyle')).toContain("scrollbarWidth: 'thin'")
    expect(styleBlock('tableWrapStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('composerBodyPreviewStyle')).toContain("overflowWrap: 'anywhere'")
    expect(functionBlock('messagePlaybookGridResponsive')).toContain("gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))'")
    expect(functionBlock('messagePlaybookCardResponsive')).toContain('minHeight: isMobile ? 112')
    expect(styleBlock('mobileSendPulseGridStyle')).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('mobileSendPulseCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileWeekStatusButtonRowStyle')).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
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
    expect(styleBlock('singlePlayerGrid')).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(styleBlock('singlePlayerGrid')).not.toContain("gridTemplateColumns: '1fr'")
    expect(styleBlock('statusButtonStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('templateBodyStyle')).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain('<details open={!isMobile} style={potentialPlayerResponsesStyle}>')
    expect(source).toContain('<GhostLink href="#captain-message-composer">Review &amp; send</GhostLink>')
    expect(source).toContain('style={isMobile ? hiddenMobileHandoffStyle : builderHandoffSurfaceStyle}')
    expect(styleBlock('potentialPlayerCardStyle')).toContain("contentVisibility: 'auto'")
  })

  it('uses readable contact cards on phones instead of compressing a desktop table', () => {
    expect(source).toContain('{isMobile ? (\n                  <div style={contactCardListStyle} aria-label="Team contacts">')
    expect(source).toContain("const contactCardListStyle: CSSProperties = { display: 'grid', gap: 10, minWidth: 0 }")
    expect(styleBlock('contactCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('contactCardActionsStyle')).toContain("gridTemplateColumns: 'minmax(0, 1fr) auto'")
    expect(source).toContain('Edit contact')
  })
})
