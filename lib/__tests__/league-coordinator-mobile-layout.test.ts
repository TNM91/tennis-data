import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
  'utf8',
)
const shellSmokeSource = readFileSync(join(process.cwd(), 'scripts/site-shell-layout-smoke.mjs'), 'utf8')

function styleBlock(sourceText: string, styleName: string) {
  const start = sourceText.indexOf(`const ${styleName}: CSSProperties = {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = sourceText.indexOf('\nconst ', start + 1)
  return sourceText.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('League Coordinator mobile layout guards', () => {
  it('stacks setup and action controls on mobile', () => {
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('const { role, userId, entitlements, authResolved } = useAuth()')
    expect(source).toContain("const resolvedRole = authResolved || !userId ? role : 'member'")
    expect(source).toContain('buildProductAccessState(resolvedRole, entitlements)')
    expect(source).not.toContain('getClientAuthState')
    expect(source).not.toContain("const [role, setRole] = useState")
    expect(source).toContain('responsiveHeroActionRowStyle')
    expect(source).toContain('responsiveButtonRowStyle')
    expect(source).toContain('responsiveParticipantBuilderStyle')
    expect(source).toContain('responsiveNextActionCardStyle')
    expect(source).toContain('responsiveNextActionButtonRowStyle')
    expect(source).toContain('mobileStackedActionRowStyle')
    expect(source).toContain('mobileParticipantBuilderStyle')
    expect(source).toContain('mobileNextActionCardStyle')
    expect(source).toContain('summaryOnly={isMobile}')
    expect(shellSmokeSource).toContain("type: 'league-mobile-summary-repeated-guidance'")
    expect(shellSmokeSource).toContain("type: 'league-mobile-summary-prompt-too-tall'")
    expect(shellSmokeSource).toContain('Ready to run organized competition without spreadsheets?')
  })

  it('keeps the setup form Data Assist upload workflow visible', () => {
    expect(source).toContain('Use uploads to refresh the season.')
    expect(source).toContain('Data Assist brings in schedules, rosters, players, teams, and official scorecards when the season changes.')
    expect(source).toContain('paste reviewed roster names from Data Assist')
    expect(source).toContain('href={DATA_ASSIST_STORY.href}')
    expect(source).not.toContain('GhostLink href="/data-assist"')
    expect(source).not.toContain('USTA API')
  })

  it('keeps first-screen workflow guidance progressive and mobile-safe', () => {
    expect(source).toContain('sharedCalendarStripStyle')
    expect(source).toContain('sharedCalendarReadinessGridStyle')
    expect(source).toContain('sharedCalendarStepGridStyle')
    expect(source).toContain('Player-arranged scheduling preview')
    expect(source).toContain('League Office-published schedule preview')
    expect(source).toContain('Your next League Office move is ready.')
    expect(source).toContain('League Office sets schedule')
    expect(source).toContain('League Office approval required')
    expect(source).toContain('League Office approval keeps join requests')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))'")
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).not.toContain("gridTemplateColumns: '34px minmax(0, 1fr)'")
  })

  it('keeps shared calendar readiness markers readable in the dark shell', () => {
    expect(source).toContain('const readinessDotStyle: CSSProperties')
    expect(source).toContain("background: 'var(--brand-lime)'")
    expect(source).toContain("color: 'var(--foreground-strong)'")
    expect(source).not.toContain("background: 'linear-gradient(135deg, var(--brand-green), var(--brand-lime))',\n  color: 'var(--text-dark)'")
  })

  it('keeps scheduling and scoring rules explicit in setup', () => {
    expect(source).toContain('Standard Score')
    expect(source).toContain('Season guardrails')
    expect(source).toContain('League duration is capped')
    expect(source).toContain('TenAceIQ calculates the end date')
    expect(source).toContain('Full set or 10-point tiebreak')
    expect(source).toContain('10-point match tiebreak')
  })

  it('keeps coordinator and player scheduling handoff visible', () => {
    expect(source).toContain('getTiqLeagueSchedulingHandoffSummary')
    expect(source).toContain('Player-arranged scheduling preview')
    expect(source).toContain('League Office-published schedule preview')
    expect(source).toContain('Players confirm details before the result is logged')
    expect(source).toContain('Data Assist uploads can refresh changes after review')
  })

  it('keeps result-entry handoff clear and Data Assist-reviewed', () => {
    expect(source).toContain('RESULT_ENTRY_HANDOFF_STEPS')
    expect(source).toContain('Team Results handles team match events and line scores')
    expect(source).toContain('Player Results handles individual league matches')
    expect(source).toContain('Reviewed Data Assist scorecards can support updates before standings move.')
    expect(source).toContain('Create a team league before opening Team Results')
    expect(source).toContain('Create an individual league before opening Player Results')
    expect(source).toContain('Use Data Assist scorecards only after review')
    expect(source).toContain('resultHandoffGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))'")
  })

  it('keeps source-to-public proof visible before sharing league pages', () => {
    expect(source).toContain('SOURCE_TO_PUBLIC_PROOF_STEPS')
    expect(source).toContain('Use a safe fixture')
    expect(source).toContain('Open the public league page and compare schedule, result, and standings context against the source screen.')
    expect(source).toContain('Private League Office controls must stay off public pages')
    expect(source).toContain('aria-label="League source to public proof cue"')
    expect(source).toContain('sourceToPublicProofStyle')
    expect(source).toContain('sourceToPublicProofStepStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))'")
  })

  it('keeps the full League Office operation proof visible before the setup form', () => {
    expect(source).toContain('LEAGUE_OFFICE_OPERATION_PROOF_STEPS')
    expect(source).toContain('League Office operation proof cue')
    expect(source).toContain('Prove the office changes the same season reality members see.')
    expect(source).toContain('Season shell')
    expect(source).toContain('Result source')
    expect(source).toContain('Member context')
    expect(source).toContain('Private boundary')
    expect(source).toContain('aria-label="League Office operation proof cue"')
    expect(source).toContain('leagueOfficeOperationProofStyle')
    expect(source).toContain('leagueOfficeOperationProofGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))'")
  })

  it('wraps coordinator registry and approval rows around long league names', () => {
    expect(source).toContain('requestCardContentStyle')
    for (const styleName of [
      'buttonRow',
      'primaryButton',
      'ghostButton',
      'requestCardContentStyle',
      'registryFooter',
      'registryTimestamp',
      'publicReadinessTitleStyle',
      'resultBookMetricStyle',
    ]) {
      const block = styleBlock(source, styleName)
      expect(block).toMatch(/minWidth: 0|overflowWrap: 'anywhere'/)
    }
  })

  it('keeps old coordinator subnav out of the league workspace', () => {
    expect(source).not.toContain('CoordinatorSubnav')
    expect(source).not.toContain('League command path')
    expect(source).not.toContain('More league tools')
  })

  it('keeps coordinator shells, grids, and action rows min-width safe', () => {
    expect(styleBlock(source, 'pageWrap')).toContain("width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))'")
    expect(styleBlock(source, 'pageWrap')).not.toContain("calc(100% - 40px)")
    expect(styleBlock(source, 'mobilePageWrap')).toContain("width: 'calc(100% - clamp(20px, 5vw, 28px))'")
    expect(styleBlock(source, 'mobilePageWrap')).not.toContain("calc(100% - 28px)")

    for (const styleName of [
      'pageWrap',
      'heroActionRow',
      'commandGrid',
      'dataAssistOpsGridStyle',
      'resultHandoffGridStyle',
      'reviewQueueGridStyle',
      'publicReadinessGridStyle',
      'publicReadinessFilterRowStyle',
      'publicReadinessCheckGridStyle',
      'resultBookGridStyle',
      'resultBookMetricRowStyle',
      'leagueOpsHeaderStyle',
      'leagueOpsHeaderCopyStyle',
      'leagueOpsScoreStyle',
      'leagueOpsTrackStyle',
      'leagueOfficeOperationProofStyle',
      'leagueOfficeOperationProofHeaderStyle',
      'leagueOfficeOperationProofGridStyle',
      'leagueOfficeOperationProofStepStyle',
      'startCardGridStyle',
      'leagueOpsCheckGridStyle',
      'detailsSummary',
      'fieldGrid',
      'outcomeInfoGrid',
      'calendarGridStyle',
      'fileInputStyle',
      'textareaStyle',
      'statusBanner',
      'nextActionButtonRowStyle',
      'emptyCard',
      'emptyRegistryPanelStyle',
      'emptyRegistryCopyStyle',
      'emptyRegistryActionRowStyle',
      'emptyPublicReadinessPanelStyle',
      'emptyPublicReadinessCopyStyle',
      'emptyPublicReadinessActionRowStyle',
      'emptyJoinRequestPanelStyle',
      'emptyJoinRequestCopyStyle',
      'emptyJoinRequestActionRowStyle',
      'registryCard',
      'noteCard',
    ]) {
      expect(styleBlock(source, styleName)).toContain('minWidth: 0')
    }
  })

  it('keeps coordinator labels, pills, controls, and dense copy wrap-safe', () => {
    for (const styleName of [
      'pillBase',
      'commandLabel',
      'commandValue',
      'dataAssistOpsCardStyle',
      'publicReadinessFilterButtonStyle',
      'reviewCueValueStyle',
      'reviewCueTitleStyle',
      'leagueOpsTextStyle',
      'leagueOpsHeaderCopyStyle',
      'leagueOpsScoreStyle',
      'leagueOfficeOperationProofStyle',
      'leagueOfficeOperationProofHeaderStyle',
      'leagueOfficeOperationProofStepStyle',
      'startActionLabelStyle',
      'startCardCtaStyle',
      'leagueOpsCheckStyle',
      'sectionEyebrow',
      'setupAssistTitleStyle',
      'setupAssistTextStyle',
      'calendarWeekStyle',
      'calendarDateStyle',
      'calendarMetaStyle',
      'calendarActionStyle',
      'photoPlaceholder',
      'fileInputStyle',
      'textareaStyle',
      'statusBanner',
      'emptyCard',
      'emptyRegistryCopyStyle',
      'emptyRegistryActionStyle',
      'emptyPublicReadinessCopyStyle',
      'emptyPublicReadinessActionStyle',
      'emptyJoinRequestCopyStyle',
      'emptyJoinRequestActionStyle',
      'registryCard',
      'noteCard',
    ]) {
      expect(styleBlock(source, styleName)).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock(source, 'pillBase')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(source, 'publicReadinessFilterButtonStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(source, 'publicReadinessFilterButtonStyle')).toContain("textAlign: 'center'")
    expect(styleBlock(source, 'calendarActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(source, 'calendarActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(source, 'leagueOpsTrackStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(source, 'emptyRegistryActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(source, 'emptyRegistryActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(source, 'emptyRegistryActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(source, 'emptyPublicReadinessActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(source, 'emptyPublicReadinessActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(source, 'emptyPublicReadinessActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock(source, 'emptyJoinRequestActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(source, 'emptyJoinRequestActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock(source, 'emptyJoinRequestActionStyle')).toContain("whiteSpace: 'normal'")
  })

  it('uses responsive grid tracks for coordinator-heavy surfaces', () => {
    for (const styleName of [
      'commandGrid',
      'dataAssistOpsGridStyle',
      'resultHandoffGridStyle',
      'reviewQueueGridStyle',
      'publicReadinessGridStyle',
      'resultBookGridStyle',
      'resultBookMetricRowStyle',
      'startCardGridStyle',
      'leagueOpsCheckGridStyle',
      'fieldGrid',
      'outcomeInfoGrid',
      'calendarGridStyle',
    ]) {
      expect(styleBlock(source, styleName)).toContain('minmax(min(100%,')
    }

    expect(source).not.toContain("whiteSpace: 'nowrap'")
    expect(source).not.toContain("linear-gradient(90deg, #4ade80, #9be11d)")
    expect(source).toContain("linear-gradient(90deg, var(--brand-green), var(--brand-lime))")
  })
})
