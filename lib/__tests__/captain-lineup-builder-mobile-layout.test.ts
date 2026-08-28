import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain lineup builder mobile layout guards', () => {
  it('keeps the hero, form shells, and workflow rows from forcing mobile overflow', () => {
    for (const styleName of [
      'pageWrap',
      'builderControlShellStyle',
      'builderControlHeaderStyle',
      'builderControlRowStyle',
      'builderLayoutResponsive',
      'columnStyle',
      'surfaceCardStrong',
      'surfaceCard',
      'sectionHeaderStyle',
      'filtersGridStyle',
      'contextSummaryGridStyle',
      'sharedNotesCardStyle',
      'actionRowStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('builderControlShellStyle')).toContain('minWidth: 0')
    expect(styleBlock('builderControlRowStyle')).toContain("gridTemplateColumns: isSmallMobile")
    expect(styleBlock('builderControlRowStyle')).toContain("? 'minmax(0, 1fr)'")
    expect(styleBlock('builderLayoutResponsive')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('builderLayoutResponsive')).toContain("'repeat(3, minmax(0, 1fr))'")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isSmallMobile ? '1fr 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '1fr'")
    expect(source).not.toContain("gridTemplateColumns: '42px minmax(0, 1fr)'")
    expect(styleBlock('sectionHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('primaryButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('ghostButton')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('ghostButtonSmallButton')).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("{!isMobile ? <CaptainSuitePanel active=\"lineup\" teamLabel={teamName || 'Team week'} /> : null}")
    expect(source.indexOf('builderControlShellStyle(isMobile)')).toBeLessThan(source.indexOf('decisionBoardShellStyle'))
  })

  it('keeps saved scenarios, slot editors, and lineup rows mobile-safe', () => {
    for (const styleName of [
      'stackStyle',
      'stackStyleCompact',
      'listCardStyle',
      'listCardStyleCompact',
      'slotCardStyle',
      'slotHeaderStyle',
      'slotHeaderLeftStyle',
      'slotPlayersGridStyle',
      'slotPlayerRowStyle',
      'tableHeaderStyle',
      'detailsSummaryStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('listCardStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('listCardStyleCompact')).toContain("flexWrap: 'wrap'")
    expect(source).toContain("gap: 8, flexWrap: 'wrap', minWidth: 0")
    expect(source).toContain("style={{ minWidth: 0, overflowWrap: 'anywhere' }}")
    expect(styleBlock('slotLabelInputStyle')).toContain("width: 'min(100%, 180px)'")
    expect(styleBlock('slotLabelInputStyle')).toContain('minWidth: 0')
  })

  it('keeps decision, projection, and lock panels resilient on narrow screens', () => {
    for (const styleName of [
      'decisionSnapshotGridStyle',
      'decisionBoardShellStyle',
      'decisionBoardHeaderStyle',
      'decisionBoardGridStyle',
      'decisionHeroCardStyle',
      'decisionCompactCardStyle',
      'decisionBoardActionRowStyle',
      'decisionCardBaseStyle',
      'actionPlanGridStyle',
      'decisionQueueGridStyle',
      'scenarioDeckGridStyle',
      'scenarioDeckCardStyle',
      'scenarioDeckButtonRowStyle',
      'projectionHeroStyle',
      'pillRowStyle',
      'miniPillStyle',
      'heroBadgeRowStyleCompact',
      'lockPanelStyle',
      'lockGridStyle',
      'lockSummaryCardStyle',
      'rightPillStackStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('miniPillStyle')).toContain("whiteSpace: 'normal'")
    for (const styleName of [
      'decisionSnapshotGridStyle',
      'actionPlanGridStyle',
      'decisionQueueGridStyle',
      'scenarioDeckGridStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    }
    expect(styleBlock('bannerBlueStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('bannerGreenStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('warningCardStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('turns a missing roster into upload, export-help, and manual-entry actions', () => {
    expect(source).toContain('Add your players to build this lineup.')
    expect(source).toContain('Upload Player Roster')
    expect(source).toContain('Enter players manually')
    expect(source).toContain('How to export the Player Roster from TennisLink')
    expect(source).toContain('Choose <strong>Send To Excel</strong>')
    expect(source).toContain("type: 'team_summary'")
    expect(source).toContain("help: '1'")
    expect(source).toContain('returnTo: context.returnTo')
    expect(source).toContain('function addManualRosterPlayers()')
    expect(source).toContain('Upload the Player Roster later to connect ratings and contact details.')
    expect(styleBlock('rosterRecoveryCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('rosterRecoveryActionGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 210px), 1fr))")
    expect(styleBlock('manualRosterEntryStyle')).toContain('minWidth: 0')
  })

  it('makes optimizer changes visible and keeps Tri-Level on three rating-specific doubles courts', () => {
    expect(source).toContain('This is a potential lineup. Review it, then confirm each player')
    expect(source).toContain('role="status" aria-live="polite"')
    expect(source).toContain('id="captain-lineup-applied-next"')
    expect(source).toContain('<strong>Next: ask your players</strong>')
    expect(source).toContain('Saves this lineup, then opens messages with the players and match details ready.')
    expect(source).toContain('{resolvedMatchFormat.label} · {matchFormatSummary.courts} courts')
    expect(source).toContain("resolvedMatchFormat.id === 'tri_level' || resolvedMatchFormat.id === 'mixed_tri_level'")
    expect(source).toContain('isPlayerEligibleForSlot(player, slot, competitionRules)')
    expect(source).toContain('isCompetitionPairRatingEligible')
    expect(source).toContain('fixedFormat={isFixedLineupFormat}')
    expect(source).toContain('<section id="captain-lineup-courts" style={surfaceCardStrong}>')
    expect(source.indexOf('id="captain-lineup-courts"')).toBeLessThan(source.indexOf('<p style={sectionKicker}>Your lineup</p>'))
    expect(styleBlock('appliedLineupNoticeStyle')).toContain('minWidth: 0')
    expect(styleBlock('appliedLineupActionStyle')).toContain('flexWrap: \'wrap\'')
    expect(styleBlock('triLevelFormatStyle')).toContain('minWidth: 0')
    expect(source).toContain('aria-label="Lineup next decision"')
    expect(source).toContain("{lineupHasAssignments ? 'Refresh lineup' : 'Build lineup'}")
    expect(source).toContain("<GhostLink href=\"#captain-lineup-courts\">Review courts</GhostLink>")
    expect(source).toContain("<PrimaryBtn onClick={() => applyOptimizedPlan('best')}>")
    expect(source).toContain('<Link href="#captain-lineup-courts" style={primaryButton}>Build lineup</Link>')
    expect(source).toContain('const mobileLineupPulse = [')
    expect(source).toContain('aria-label="Lineup readiness pulse"')
    expect(source).toContain("label: 'Courts'")
    expect(source).toContain("label: 'Replies'")
    expect(source).toContain("label: 'Roster'")
    expect(styleBlock('mobileLineupPulseStyle')).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('mobileLineupPulseCardStyle')).toContain('minWidth: 0')
    expect(source).toContain('const mobileCourtMap = analysis.lines.map')
    expect(source).toContain('aria-label="Court map"')
    expect(source).toContain('Where to lean in')
    expect(source).toContain("? 'Edge'")
    expect(source).toContain("? 'Protect'")
    expect(source).toContain(": 'Swing'")
    for (const styleName of [
      'mobileCourtMapShellStyle',
      'mobileCourtMapHeaderStyle',
      'mobileCourtMapGridStyle',
      'mobileCourtMapValueRowStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
    expect(styleBlock('mobileCourtMapGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 132px), 1fr))")
    expect(source).toContain('style={isMobile ? hiddenMobileContextStyle : surfaceCard}')
  })
})
