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
      'opponentCourtSetupChoiceStyle',
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
    for (const styleName of [
      'slotEditorBodyStyle',
      'compactCourtTriggerStyle',
      'compactCourtTriggerHeaderStyle',
      'compactCourtTriggerFooterStyle',
      'slotHeaderActionsStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
    expect(source).toContain('const [expandedTeamSlotId, setExpandedTeamSlotId] = useState(\'\')')
    expect(source).toContain('aria-controls={`captain-lineup-slot-editor-${slot.id}`}')
    expect(source).toContain('Edit court')
    expect(source).toContain('>Done</GhostSmallBtn>')
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
    expect(source).toContain('Upload Team Summary')
    expect(source).toContain('Enter players manually')
    expect(source).toContain('How to export a Team Summary from TennisLink')
    expect(source).toContain('Choose <strong>Send To Excel</strong>')
    expect(source).toContain('Watch the 1-minute Team Summary video guide')
    expect(source).toContain('href="/resources/usta-upload#quick-guide"')
    expect(source).toContain("type: 'team_summary'")
    expect(source).toContain("help: '1'")
    expect(source).toContain('returnTo: context.returnTo')
    expect(source).toContain('function addManualRosterPlayers()')
    expect(source).toContain('Upload the Team Summary for ratings, then add Player Roster later if you want team contacts.')
    expect(styleBlock('rosterRecoveryCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('rosterRecoveryActionGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 210px), 1fr))")
    expect(styleBlock('manualRosterEntryStyle')).toContain('minWidth: 0')
  })

  it('treats an absent opponent roster as a compact recovery choice, not a failure', () => {
    expect(source).toContain('aria-label="Opponent roster options"')
    expect(source).toContain('has not been added yet.')
    expect(source).toContain('Enter names now, or add its TennisLink Team Summary for TiQ ratings.')
    expect(source).toContain('Upload TennisLink roster')
    expect(source).toContain('function addManualOpponentRosterPlayers()')
    expect(source).toContain('const scopedManualOpponentRosterPlayers = useMemo(')
    expect(source).toContain('const opponentSummaryUploadHref = useMemo(')
    expect(source).not.toContain('No opponent roster is available for {opponentTeam} yet.')
    expect(styleBlock('opponentRosterRecoveryStyle')).toContain('minWidth: 0')
    expect(styleBlock('opponentRosterManualEntryStyle')).toContain("gridColumn: '1 / -1'")
  })

  it('confirms when opponent players are ready and opens the opponent courts directly', () => {
    expect(source).toContain('aria-label="Opponent roster ready"')
    expect(source).toContain('TiQ ratings are available where matched.')
    expect(source).toContain('Set opponent courts')
    expect(source).toContain("document.getElementById('opponent-lineup')?.scrollIntoView")
    expect(source).toContain('<section id="opponent-lineup" style={surfaceCardStrong}>')
    expect(styleBlock('opponentRosterReadyStyle')).toContain('minWidth: 0')
  })

  it('keeps manual opponent names available after a Builder refresh or upload return', () => {
    expect(source).toContain('function restoreManualRosterPlayers(')
    expect(source).toContain('const persistedManualRosterDraft = persistedDirectCourtTextHandoff?.builderDraft ?? persistedDeviceBuilderDraft')
    expect(source).toContain('manualRosterEntries: manualRosterPlayers.slice(-80).map((player) => ({')
    expect(source).toContain('const restoredManualRosterPlayers = restoreManualRosterPlayers(storedDraft)')
  })

  it('keeps a missing mobile number in the Builder instead of sending the captain to another screen', () => {
    expect(source).toContain('Add {player.playerName.split(\' \')[0]}’s mobile number')
    expect(source).toContain('Save mobile & prepare Ask')
    expect(source).toContain("await askProposedCourtPlayers(slot, invitedPlayer, { contactPhone: phone })")
    expect(source).toContain("fetch('/api/captain/team-contacts'")
    expect(source).toContain('Sign in again before saving this mobile number.')
    expect(source).toContain('const existingContact = captainRosterContactsForTeam.find')
    expect(styleBlock('courtAskControlStyle')).toContain('minWidth: 0')
    expect(styleBlock('courtPhoneFormStyle')).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(styleBlock('courtPhoneLabelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('inputStyle')).toContain("boxSizing: 'border-box'")
    expect(styleBlock('mobileSelectInputStyle')).toContain("textOverflow: 'ellipsis'")
    expect(styleBlock('mobileReplacementHandoffActionsStyle')).toContain("width: '100%'")
    expect(styleBlock('mobileCourtAskControlStyle')).toContain("width: '100%'")
    expect(styleBlock('mobileCourtPhoneFormStyle')).toContain("boxSizing: 'border-box'")
    expect(styleBlock('mobileSmsFallbackLinkStyle')).toContain("width: '100%'")
    expect(source).toContain('fullWidth={isMobileLayout}')
    expect(styleBlock('mobileCourtFocusActionsStyle')).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(source).toContain('>Team contacts</GhostLink>')
  })

  it('keeps hands-on building focused while making matchup insights a compact optional action', () => {
    expect(source).toContain("const [builderMode, setBuilderMode] = useState<BuilderMode>('manual')")
    expect(source).toContain('Scouting &amp; matchup forecast')
    expect(source).toContain('Open matchup insights')
    expect(source).toContain('Back to my lineup')
    expect(source).toContain("<details id=\"captain-lineup-insights\" open={builderMode === 'insights'} style={surfaceCardStrong}>")
    expect(source).toContain('Opponent + insights')
    expect(source).toContain("{builderMode === 'insights' ? <div style={columnStyle}>")
    for (const styleName of ['builderInsightToggleStyle', 'builderInsightCopyStyle', 'builderInsightButtonStyle']) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
    expect(styleBlock('builderInsightButtonStyle')).toContain("width: '100%'")
    expect(source).toContain("document.getElementById('captain-lineup-insights')?.scrollIntoView")
  })

  it('keeps phone auto-build to one primary action and puts optimizer detail behind disclosures', () => {
    expect(source).toContain('>Auto-build my lineup</PrimaryBtn>')
    expect(source).toContain('>Build options</p>')
    expect(source).toContain('Locks, opponent, and alternates')
    expect(source).toContain('>Rebuild around locks</GhostBtn>')
    expect(source).toContain('>Auto-fill opponent</GhostBtn>')
    expect(source).toContain('>Match insight</p>')
    expect(source).toContain('How to win this match')
  })

  it('starts completed match setup collapsed while keeping its match summary visible', () => {
    expect(source).toContain('const [matchSetupOpen, setMatchSetupOpen] = useState(')
    expect(source).toContain('() => !(initialTeamName && initialOpponentTeam && initialMatchDate)')
    expect(source).toContain('const didAutoCollapseMatchSetupRef = useRef(false)')
    expect(source).toContain('if (!hasCoreContext || didAutoCollapseMatchSetupRef.current) return')
    expect(source).toContain('setMatchSetupOpen(false)')
    expect(source).toContain('const matchSetupSummary = hasCoreContext')
    expect(source).toContain('open={matchSetupOpen}')
    expect(source).toContain('onToggle={(event) => setMatchSetupOpen(event.currentTarget.open)}')
    expect(source).toContain("{hasCoreContext ? 'Ready' : 'Needs match'}")
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
    expect(source).toContain('const teamCourtProgress = useMemo(() =>')
    expect(source).toContain('const teamLineupComplete = completedTeamCourtCount === teamCourtProgress.length')
    expect(source).toContain('Scout opponent &amp; forecast')
    expect(source).toContain('const recentHistoricalLineup = useMemo<HistoricalLineupSuggestion | null>(() =>')
    expect(source).toContain('Use recent lineup')
    expect(source).toContain('fills open spots only')
    expect(source).toContain('Your existing court choices stayed in place.')
    expect(source).toContain('no recent players were added')
    expect(source).toContain("builderMode === 'insights' && mobileCourtMap.length")
    expect(source).toContain('Finish {firstOpenTeamCourt.label}')
    expect(source).toContain('<GhostBtn onClick={() => focusTeamCourts()}>Review courts</GhostBtn>')
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
    expect(source).toContain('function focusTeamCourts(nextSlots: LineupSlot[] = teamSlots, preferredCourtId = \'\')')
    expect(source).toContain('function focusTeamCourtsAfterBuild(nextSlots: LineupSlot[] = teamSlots)')
    expect(source).toContain('setExpandedTeamSlotId(courtToOpen)')
    expect(source).toContain('document.getElementById(`captain-lineup-slot-${courtToOpen}`)')
    expect(source).toContain("?.scrollIntoView({ behavior: 'smooth', block: 'start' })")
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

  it('gives mobile captains a clear final lineup check before they send the team update', () => {
    expect(source).toContain('aria-label="Final lineup status"')
    expect(source).toContain('Ready to send.')
    expect(source).toContain('Send lineup to team')
    expect(source).toContain('Edit courts')
    expect(source).toContain('<GhostBtn onClick={() => focusTeamCourts()}>Review player replies</GhostBtn>')
    expect(source).toContain('<GhostBtn onClick={() => focusTeamCourts()}>Edit courts</GhostBtn>')
    for (const styleName of [
      'mobileFinalLineupPanelStyle',
      'mobileFinalLineupHeaderStyle',
      'mobileFinalLineupCopyStyle',
      'mobileFinalLineupActionsStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
    expect(styleBlock('mobileFinalLineupActionsStyle')).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
  })
})
