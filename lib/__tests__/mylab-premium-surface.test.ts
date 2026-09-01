import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const commandStyles = readFileSync(join(process.cwd(), 'app/mylab/my-lab-command-center.module.css'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('My Lab premium surface', () => {
  it('keeps saved Match Prep reviews private and mobile-safe', () => {
    expect(source).toContain("activeGoal.id.startsWith('matchup-prep-')")
    expect(source).toContain('Did the plan hold up?')
    expect(source).toContain('Plan held')
    expect(source).toContain('Adjust plan')
    expect(source).toContain('matchPrepReviewStyle(isTablet)')
    expect(source).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto'")
  })
  it('keeps the top read tennis-specific and Data Assist aware', () => {
    expect(source).toContain('buildMatchIntelligenceRead')
    expect(source).toContain('Match Intelligence')
    expect(source).toContain('Rating Journey')
    expect(source).toContain('buildPlayerRatingJourneyRead')
    expect(source).toContain(".from('rating_snapshots')")
    expect(source).toContain(".eq('track', 'tiq')")
    expect(source).toContain('Rating evidence')
    expect(source).toContain('Your next focus')
    expect(source).toContain('canUseAdvancedPlayerInsights ? (')
    expect(source).toContain('starterActionCards')
    expect(source).toContain("const dataAssistMyLabHref = '/data-assist?intent=upload-source&context=My%20Lab'")
    expect(source).toContain('href: dataAssistMyLabHref')
    expect(source).toContain('matchIntelligence.patternLabel')
    expect(source).toContain('Open match history')
    expect(source).toContain('Upload scores')
    expect(source).toContain('Use a scorecard or Player Roster to replace the starter rating with verified match context.')
    expect(source).toContain('Start your TIQ signal with a scorecard, a local league match, a TIQ league, or a close player to test.')
    expect(source).toContain('Open Data Assist')
    expect(source).toContain("headline={isMobile ? 'Unlock My Lab.' : MY_LAB_STORY.upgradeHeadline}")
    expect(source).toContain("body={isMobile ? 'Open progress, matchup prep, and cleaner tennis messages.' : MY_LAB_STORY.upgradeBody}")
    expect(source).toContain("secondaryLabel={isMobile ? 'Plans' : MY_LAB_STORY.upgradeSecondary}")
    expect(source).toContain("footnote={isMobile ? undefined : MY_LAB_STORY.upgradeFootnote}")
    expect(source).toContain('Pick the next move, then keep the proof connected.')
    expect(source).toContain('My Lab answers what to work on, how you are improving, which matchups matter, and which drill or resource should come next.')
    expect(source).toContain("value: 'Next move'")
    expect(source).toContain('Your self-rated profile is live. Add a scorecard or match signal when ready.')
    expect(source).toContain("value: isNewSelfRatedProfile ? 'First signal' : 'Refresh'")
    expect(source).toContain('Find a local player and start your first comparison.')
    expect(source).toContain('How am I improving?')
    expect(source).toContain('What should I work on?')
    expect(source).toContain('Today&apos;s next move')
    expect(source).toContain('Level-up meter')
    expect(source).not.toContain('USTA API')
    expect(source).not.toContain('direct USTA feed')
  })

  it('keeps read and starter cards responsive for dark-shell mobile scanning', () => {
    expect(source).toContain('personalReadGridStyle(isTablet)')
    expect(source).toContain('starterGridStyle(isTablet)')
    expect(source).toContain('matchIntelligenceGridStyle(isTablet)')
    expect(source).toContain('ratingJourneyGridStyle(isTablet)')
    expect(source).toContain('matchupQueueGridStyle(isTablet)')
    expect(source).toContain('gridTemplateColumns: isTablet')
    expect(source).toContain('minmax(0, 1fr)')
    expect(source).toContain("overflowWrap: 'anywhere'")
  })

  it('turns merged Level Up proof into one account-aware weekly plan', () => {
    expect(source).toContain('LEVEL_UP_COMPLETIONS_KEY')
    expect(source).toContain('readLocalLevelUpCompletions')
    expect(source).toContain('mergeMyLabLevelUpProofRecords(localLevelUpCompletions, remoteLevelUpSessions)')
    expect(source).toContain('buildMyLabWeeklyImprovementPlan(levelUpProofRecords)')
    expect(source).toContain("fetch('/api/player/level-up-sessions'")
    expect(source).toContain('LevelUpReturnStatePanel')
    expect(source).toContain('plan={weeklyImprovementPlan}')
    expect(source).toContain('aria-label="My Lab weekly improvement plan"')
    expect(source).toContain('One plan built from your latest proof.')
    expect(source).toContain('Next court action')
    expect(source).toContain('Weekly proof')
    expect(source).toContain('weeklyImprovementProgressFillStyle(plan.progressPercent)')
    expect(source).toContain('Weekly improvement plan steps')
    expect(source).toContain("label: 'Train'")
    expect(source).toContain("label: 'Prove'")
    expect(source).toContain("label: 'Adjust'")
    expect(source).toContain('Coach-ready summary')
    expect(source).toContain('{plan.coachSummary}')
    expect(source).toContain('Proof history and handoffs')
    expect(source).toContain('Recent scores, habits, coach sharing, and sync details.')
    expect(source).toContain("href={signedIn ? '/mylab#coach-assignments' : '/login'}")
    expect(source).toContain('Account proof is current across devices.')
    expect(source).toContain('Account proof is unavailable. Showing this device instead.')
    expect(source).toContain('Assignment completed. Your coach can review the recap from Coach Hub.')
    expect(source).not.toContain('Assignment completed. Your coach can review the recap from their workspace.')
  })

  it('uses theme-safe First Serve number contrast', () => {
    expect(commandStyles).toContain('.firstServeNumber')
    expect(commandStyles).toContain('color: #83c8ff;')
    expect(commandStyles).toContain('.firstServeStepCurrent .firstServeNumber')
    expect(commandStyles).toContain('background: #a9eb08;')
    expect(commandStyles).toContain('color: #071426;')
  })

  it('keeps My Lab numbered markers shell-aware instead of dark text on gradients', () => {
    for (const marker of [
      'matchupQueueRankStyle',
      'readinessPillStyle',
    ]) {
      expect(source).toContain(marker)
    }

    expect(source).not.toContain("background: complete ? 'var(--brand-green)' : 'var(--shell-panel-bg)',\n  color: complete ? 'var(--text-dark)' : 'var(--foreground-strong)'")
    expect(source).not.toContain("const matchupQueueRankStyle: CSSProperties = {\n  width: 34,\n  height: 34,\n  borderRadius: '50%',\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-lime), var(--brand-green))',\n  color: 'var(--text-dark)'")
  })

  it('keeps My Lab premium and personal grids minmax-safe on mobile', () => {
    expect(source).not.toContain("? '1fr'")

    for (const styleName of [
      'developmentPathGridStyle',
      'personalReadGridStyle',
      'levelUpPanelStyle',
      'quickProfileGridStyle',
      'starterGridStyle',
      'matchIntelligenceGridStyle',
      'ratingJourneyGridStyle',
      'matchupSpotlightHeroStyle',
      'matchupPreviewGridStyle',
      'matchupQueueGridStyle',
      'matchPlanGridStyle',
      'performanceGridStyle',
      'trophyRoomGridStyle',
      'trophyProofGridStyle',
      'personalCommandGridStyle',
      'tiqActionGridStyle',
      'teamPrepGridStyle',
      'goalSummaryGridStyle',
      'workshopGridStyle',
      'goalFieldGridStyle',
      'contentGridStyle',
    ]) {
      const block = styleBlock(styleName)
      expect(block).toMatch(/minmax\((0|min\(100%, [^)]+\)), 1fr\)/)
      expect(block).toContain('minWidth: 0')
    }

    for (const styleName of [
      'personalReadPanelStyle',
      'profileLinkSectionStyle',
      'developmentPathPanelStyle',
      'developmentPathHeaderStyle',
      'developmentIdentityCardStyle',
      'levelUpReturnPanelStyle',
      'levelUpReturnGridStyle',
      'levelUpReturnPrimaryStyle',
      'levelUpReturnMetricGridStyle',
      'levelUpReturnStorageNoteStyle',
      'myLabTodayFeedStyle',
      'myLabTodayFeedHeaderStyle',
      'myLabTodayFeedGridStyle',
      'myLabTodayFeedCardStyle',
      'myLabTodayFeedActionStyle',
      'myLabLevelUpTodayCardStyle',
      'myLabLevelUpTodayMetricGridStyle',
      'myLabLevelUpTodayActionRowStyle',
      'myLabRefreshProofCueStyle',
      'myLabRefreshProofHeaderStyle',
      'myLabRefreshProofGridStyle',
      'myLabRefreshProofCardStyle',
      'quickProfileStyle',
      'starterPanelStyle',
      'starterCardStyle',
      'matchIntelligencePanelStyle',
      'matchIntelligenceHeaderStyle',
      'matchIntelligenceCardStyle',
      'matchIntelligenceFocusCardStyle',
      'ratingJourneyPanelStyle',
      'ratingJourneyHeaderStyle',
      'ratingJourneyCardStyle',
      'ratingJourneyTrendStyle',
      'ratingJourneyPlotStyle',
      'ratingJourneyPlotPointStyle',
      'ratingJourneyEmptyStyle',
      'matchupSpotlightStyle',
      'matchupQueueCardStyle',
      'matchupQueueCopyStyle',
      'performancePanelStyle',
      'matchPlanPanelStyle',
      'matchPlanCardStyle',
      'tiqActionRailStyle',
      'teamPrepRailStyle',
      'workshopPanelStyle',
      'performanceGridStyle',
      'performanceCardStyle',
      'trophyRoomPanelStyle',
      'trophyRoomGridStyle',
      'trophyCardStyle',
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
      'optionalContextDetailsStyle',
      'labDrawerDetailsStyle',
      'labDrawerSummaryStyle',
      'labDrawerSummaryCopyStyle',
      'labDrawerContentStyle',
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
      'warningNoteStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('levelUpReturnPanelStyle')).toContain('scrollMarginTop: 96')

    for (const styleName of [
      'matchupQueueNameStyle',
      'matchupQueueMetaStyle',
      'matchupQueueFitStyle',
      'performanceCardTitleStyle',
      'trophyValueStyle',
      'workshopRowTitleStyle',
      'workshopRowMetaStyle',
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
      'saveNotebookButtonStyle',
      'metricLabelStyle',
      'metricNoteStyle',
      'secondaryButtonStyle',
      'starterCardStyle',
      'levelUpReturnPrimaryTitleStyle',
      'levelUpReturnPrimaryTextStyle',
      'levelUpReturnStorageNoteStyle',
      'levelUpReturnStorageNoteStrongStyle',
      'myLabTodayFeedStyle',
      'myLabTodayFeedHeaderStyle',
      'myLabTodayFeedCardStyle',
      'myLabTodayFeedActionStyle',
      'myLabRefreshProofCueStyle',
      'myLabRefreshProofHeaderStyle',
      'myLabRefreshProofCardStyle',
      'myLabRefreshProofLabelStyle',
      'myLabRefreshProofTextStyle',
      'todayReadValueStyle',
      'matchPlanTextStyle',
      'trophyProofItemStyle',
      'warningNoteStyle',
      'matchupSpotlightHeroStyle',
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

    for (const styleName of [
      'quickStartButtonStyle',
      'smallGhostButtonStyle',
      'matchReflectButtonStyle',
      'saveNotebookButtonStyle',
      'readinessPillStyle',
      'optionalContextCountStyle',
      'secondaryButtonStyle',
    ]) {
      expect(styleBlock(styleName)).toContain("maxWidth: '100%'")
      expect(styleBlock(styleName)).toContain("whiteSpace: 'normal'")
    }

    const matchupSpotlightHeroBlock = styleBlock('matchupSpotlightHeroStyle')
    expect(matchupSpotlightHeroBlock).toContain("'minmax(0, 1fr) minmax(0, auto)'")
    expect(matchupSpotlightHeroBlock).not.toContain("gridTemplateColumns: 'auto minmax(0, 1fr)'")
    expect(matchupSpotlightHeroBlock).not.toContain("'minmax(0, 1fr) auto'")
  })

  it('keeps the optional drawer framed as lab context instead of another tools menu', () => {
    expect(source).toContain('Deeper lab read')
    expect(source).toContain('Goals, trends, and records after the quick read.')
    expect(source).toContain('3 views')
    expect(source).not.toContain('More player tools')
    expect(source).not.toContain('3 tools')
  })
})
