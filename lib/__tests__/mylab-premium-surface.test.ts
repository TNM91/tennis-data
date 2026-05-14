import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('My Lab premium surface', () => {
  it('keeps the top routine tennis-specific and Data Assist aware', () => {
    expect(source).toContain('MY_LAB_PREMIUM_SIGNALS')
    expect(source).toContain('MY_LAB_READABILITY_CUES')
    expect(source).toContain('Personal scorecard')
    expect(source).toContain('Match prep')
    expect(source).toContain('Reviewed uploads')
    expect(source).toContain('Use reviewed uploads for scorecards, schedules, and rosters')
    expect(source).toContain('Connect your player record, review what changed, and leave with one action for the next match.')
    expect(source).toContain('Player identity')
    expect(source).toContain('Scorecard review')
    expect(source).toContain('Match-day action')
    expect(source).not.toContain('USTA API')
  })

  it('keeps premium signal cards responsive for light-mode mobile scanning', () => {
    expect(source).toContain('labPremiumSignalGridStyle(isTablet)')
    expect(source).toContain('labPremiumSignalCardStyle')
    expect(source).toContain('gridTemplateColumns: isTablet')
    expect(source).toContain('minmax(0, 1fr)')
    expect(source).toContain('labReadabilityCueGridStyle(isTablet)')
    expect(source).toContain('overflowWrap: \'anywhere\'')
  })

  it('uses theme-safe setup step number contrast', () => {
    expect(source).toContain('setupStepNumberStyle')
    expect(source).toContain("color: 'var(--foreground-strong)'")
    expect(source).toContain("background: 'color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-chip-bg) 78%)'")
    expect(source).not.toContain("const setupStepNumberStyle: CSSProperties = {\n  width: 32,\n  height: 32,\n  borderRadius: '50%',\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-lime), var(--brand-green))',\n  color: 'var(--text-dark)'")
  })

  it('keeps My Lab numbered markers shell-aware instead of dark text on gradients', () => {
    for (const marker of [
      'labRoutineNumberStyle',
      'labPlaybookStepStyle',
      'setupStepNumberStyle',
      'matchupQueueRankStyle',
    ]) {
      expect(source).toContain(marker)
    }

    expect(source).not.toContain("const labRoutineNumberStyle: CSSProperties = {\n  width: 34,\n  height: 34,\n  borderRadius: 14,\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-blue-2), var(--brand-green))',\n  color: 'var(--text-dark)'")
    expect(source).not.toContain("background: complete ? 'var(--brand-green)' : 'var(--shell-panel-bg)',\n  color: complete ? 'var(--text-dark)' : 'var(--foreground-strong)'")
    expect(source).not.toContain("const matchupQueueRankStyle: CSSProperties = {\n  width: 34,\n  height: 34,\n  borderRadius: '50%',\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-lime), var(--brand-green))',\n  color: 'var(--text-dark)'")
  })

  it('keeps My Lab premium and personal grids minmax-safe on mobile', () => {
    expect(source).not.toContain("? '1fr'")

    for (const styleName of [
      'labReadabilityCueGridStyle',
      'labPremiumSignalGridStyle',
      'labRoutineGridStyle',
      'labRoutineStepStyle',
      'paidWorkspaceProofGridStyle',
      'labPlaybookGridStyle',
      'labPlaybookCardStyle',
      'levelUpPanelStyle',
      'quickProfileGridStyle',
      'setupStepGridStyle',
      'matchupSpotlightHeroStyle',
      'matchupPreviewGridStyle',
      'matchupQueueGridStyle',
      'matchupQueueCardStyle',
      'matchPlanGridStyle',
      'personalCommandGridStyle',
      'tiqActionGridStyle',
      'teamPrepGridStyle',
      'workshopGridStyle',
      'workshopMatchRowStyle',
      'goalFieldGridStyle',
      'contentGridStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("minmax(0, 1fr)")
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    for (const styleName of [
      'personalReadPanelStyle',
      'labPlaybookPanelStyle',
      'quickProfileStyle',
      'setupPanelStyle',
      'matchupSpotlightStyle',
      'performancePanelStyle',
      'matchPlanPanelStyle',
      'tiqActionRailStyle',
      'teamPrepRailStyle',
      'workshopPanelStyle',
      'performanceGridStyle',
      'performanceCardStyle',
      'trophyRoomPanelStyle',
      'trophyRoomGridStyle',
      'trophyCardStyle',
      'matchupQueueCardStyle',
      'matchupQueueFitStyle',
      'miniActionPillStyle',
      'goalProgressPanelStyle',
      'goalSummaryGridStyle',
      'goalSummaryCardStyle',
      'goalReadinessPanelStyle',
      'goalReadinessHeaderStyle',
      'goalReadinessChecklistStyle',
      'recommendationCardStyle',
      'quickStartPanelStyle',
      'quickStartButtonRowStyle',
      'goalWorkspaceStyle',
      'goalListStyle',
      'goalTabStyle',
      'goalTabMetaRowStyle',
      'goalEditorDetailsStyle',
      'goalFooterActionsStyle',
      'notebookFooterStyle',
      'nextActionCardStyle',
      'optionalContextDetailsStyle',
      'optionalContextSummaryStyle',
      'compactSignalsPanelStyle',
      'compactSignalsHeaderStyle',
      'compactSignalsGridStyle',
      'compactSignalCardStyle',
      'leftColumnStyle',
      'rightColumnStyle',
      'surfaceStrongStyle',
      'surfaceStyle',
      'sectionHeaderStyle',
      'searchPanelStyle',
      'inputWrapStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    for (const styleName of [
      'matchupQueueNameStyle',
      'matchupQueueMetaStyle',
      'matchupQueueFitStyle',
      'performanceCardTitleStyle',
      'trophyValueStyle',
      'workshopRowTitleStyle',
      'workshopRowMetaStyle',
      'workshopMatchRowStyle',
      'miniActionPillStyle',
      'compactSectionTitleStyle',
      'goalSummaryValueStyle',
      'goalReadinessTextStyle',
      'goalReadinessScoreStyle',
      'readinessPillStyle',
      'recommendationTextStyle',
      'quickStartTextStyle',
      'quickStartButtonStyle',
      'smallGhostButtonStyle',
      'collapsibleSummaryStyle',
      'goalTabStyle',
      'goalTabMetaRowStyle',
      'miniActionLinkStyle',
      'reportStatusTextStyle',
      'matchReflectButtonStyle',
      'notebookFooterStyle',
      'nextActionCardStyle',
      'saveNotebookButtonStyle',
      'metricLabelStyle',
      'metricNoteStyle',
      'optionalContextSummaryStyle',
      'optionalContextCountStyle',
      'compactSignalsHeaderStyle',
      'compactSignalNameStyle',
      'compactSignalMetaStyle',
      'sectionKickerStyle',
      'sectionTextStyle',
      'labelStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('labRoutineStepStyle')).toContain("'minmax(0, 2.125rem) minmax(0, 1fr)'")
    expect(styleBlock('labPlaybookCardStyle')).toContain("'minmax(0, 1.875rem) minmax(0, 1fr)'")
    expect(styleBlock('matchupSpotlightHeroStyle')).toContain("'minmax(0, 1fr) minmax(0, 10rem)'")
    expect(styleBlock('matchupQueueCardStyle')).toContain("'minmax(0, 2.125rem) minmax(0, 1fr) minmax(0, 4.5rem)'")
    expect(styleBlock('workshopMatchRowStyle')).toContain("'minmax(0, 2.125rem) minmax(0, 1fr) minmax(0, 8rem)'")
    expect(styleBlock('nextActionCardStyle')).toContain("'minmax(0, 2.125rem) minmax(0, 1fr) minmax(0, 8rem)'")
    expect(source).not.toContain("gridTemplateColumns: 'auto minmax(0, 1fr)")
    expect(source).not.toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto'")

    for (const styleName of [
      'quickStartButtonStyle',
      'smallGhostButtonStyle',
      'matchReflectButtonStyle',
      'saveNotebookButtonStyle',
      'readinessPillStyle',
      'optionalContextCountStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("maxWidth: '100%'")
      expect(styleBlock(styleName)).toContain("whiteSpace: 'normal'")
    }
  })
})
