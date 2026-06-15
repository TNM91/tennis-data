import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('My Lab premium surface', () => {
  it('keeps the top read tennis-specific and Data Assist aware', () => {
    expect(source).toContain('scorecardSummaryCards')
    expect(source).toContain('starterActionCards')
    expect(source).toContain("const dataAssistMyLabHref = '/data-assist?intent=upload-source&context=My%20Lab'")
    expect(source).toContain('href: dataAssistMyLabHref')
    expect(source).toContain('href={dataAssistMyLabHref}')
    expect(source).toContain('Recent record')
    expect(source).toContain('Matchup read')
    expect(source).toContain('Upload scores')
    expect(source).toContain('Use a scorecard or team summary to replace the starter rating with verified match context.')
    expect(source).toContain('Start your TIQ signal with a scorecard, a local league match, a TIQ league, or a close player to test.')
    expect(source).toContain('Open Data Assist')
    expect(source).toContain('My Lab is the home base. Data Assist, Matchup, and Messages stay one move away.')
    expect(source).toContain("value: 'Home base'")
    expect(source).toContain('Your self-rated profile is live. Add a scorecard or match signal when ready.')
    expect(source).toContain("value: isNewSelfRatedProfile ? 'First signal' : 'Refresh'")
    expect(source).toContain('Find a local player and start your first comparison.')
    expect(source).toContain('Today&apos;s next move')
    expect(source).toContain('Level-up meter')
    expect(source).not.toContain('USTA API')
    expect(source).not.toContain('direct USTA feed')
  })

  it('keeps read and starter cards responsive for dark-shell mobile scanning', () => {
    expect(source).toContain('personalReadGridStyle(isTablet)')
    expect(source).toContain('starterGridStyle(isTablet)')
    expect(source).toContain('todayReadGridStyle(isTablet)')
    expect(source).toContain('matchupQueueGridStyle(isTablet)')
    expect(source).toContain('gridTemplateColumns: isTablet')
    expect(source).toContain('minmax(0, 1fr)')
    expect(source).toContain("overflowWrap: 'anywhere'")
  })

  it('pulls Level Up proof into My Lab return state with honest local sync copy', () => {
    expect(source).toContain('LEVEL_UP_COMPLETIONS_KEY')
    expect(source).toContain('readLocalLevelUpCompletions')
    expect(source).toContain('buildMyLabLevelUpProofs')
    expect(source).toContain('getMyLabLevelUpStreak')
    expect(source).toContain('LevelUpReturnStatePanel')
    expect(source).toContain("questHref: `/level-up/${primaryIdentitySlug}?questCard=${encodeURIComponent(completion.cardId)}#quest-builder`")
    expect(source).toContain('Level Up return state')
    expect(source).toContain("Today's Level Up card")
    expect(source).toContain('Active drill')
    expect(source).toContain('Last proof')
    expect(source).toContain('Streak')
    expect(source).toContain('Resume drill')
    expect(source).toContain('Turn into habit')
    expect(source).toContain("Today&apos;s Level Up habit")
    expect(source).toContain('My Lab today feed')
    expect(source).toContain("Today's habit")
    expect(source).toContain('Next drill')
    expect(source).toContain('Proof to save')
    expect(source).toContain('myLabTodayFeedStyle')
    expect(source).toContain('myLabTodayFeedGridStyle')
    expect(source).toContain('myLabTodayFeedActionStyle')
    expect(source).toContain('levelUpTodayHabitStyle')
    expect(source).toContain('Add as quest')
    expect(source).toContain('No Level Up proof in this browser yet')
    expect(source).toContain('Repeat in Level Up')
    expect(source).toContain('Start next rep')
    expect(source).toContain('This panel is reading this browser only.')
    expect(source).toContain('Private windows can forget it')
    expect(source).toContain('Signed-in Player+ or coach-linked proof can sync history')
    expect(source).toContain('My Lab refresh proof cue')
    expect(source).toContain('What should still be clear after refresh?')
    expect(source).toContain('Find yourself first so My Lab is not a generic dashboard.')
    expect(source).toContain('Player record, follows, matchup notes, and coach context can anchor here.')
    expect(source).toContain('Recent Level Up proof appears from this browser cache')
    expect(source).toContain('No Level Up proof is shown unless this browser has saved it.')
    expect(source).toContain('Add one pressure layer, not a new habit.')
    expect(source).toContain('Repeat the same card cleaner.')
    expect(source).toContain('Scale down and chase one clean cue.')
  })

  it('uses theme-safe setup step number contrast', () => {
    expect(source).toContain('setupStepNumberStyle')
    expect(source).toContain("color: 'var(--foreground-strong)'")
    expect(source).toContain("background: 'color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-chip-bg) 78%)'")
    expect(source).not.toContain("const setupStepNumberStyle: CSSProperties = {\n  width: 32,\n  height: 32,\n  borderRadius: '50%',\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-lime), var(--brand-green))',\n  color: 'var(--text-dark)'")
  })

  it('keeps My Lab numbered markers shell-aware instead of dark text on gradients', () => {
    for (const marker of [
      'setupStepNumberStyle',
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
      'setupStepGridStyle',
      'starterGridStyle',
      'todayReadGridStyle',
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
      'setupPanelStyle',
      'starterPanelStyle',
      'starterCardStyle',
      'todayReadPanelStyle',
      'todayReadCardStyle',
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
      'todayReadCardStyle',
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
