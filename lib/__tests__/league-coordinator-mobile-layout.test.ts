import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
  'utf8',
)

const subnavSource = readFileSync(
  join(process.cwd(), 'app/components/coordinator-subnav.tsx'),
  'utf8',
)

function styleBlock(sourceText: string, styleName: string) {
  const start = sourceText.indexOf(`const ${styleName}: CSSProperties = {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = sourceText.indexOf('\nconst ', start + 1)
  return sourceText.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('League Coordinator mobile layout guards', () => {
  it('stacks setup and action controls on mobile', () => {
    expect(source).toContain('responsiveHeroActionRowStyle')
    expect(source).toContain('responsiveButtonRowStyle')
    expect(source).toContain('responsiveParticipantBuilderStyle')
    expect(source).toContain('responsiveNextActionCardStyle')
    expect(source).toContain('responsiveNextActionButtonRowStyle')
    expect(source).toContain('mobileStackedActionRowStyle')
    expect(source).toContain('mobileParticipantBuilderStyle')
    expect(source).toContain('mobileNextActionCardStyle')
  })

  it('keeps the setup form Data Assist upload workflow visible', () => {
    expect(source).toContain('Upload data')
    expect(source).toContain('Use uploads as the coordinator refresh path.')
    expect(source).toContain('paste reviewed roster names from Data Assist')
    expect(source).not.toContain('USTA API')
  })

  it('keeps first-screen workflow guidance progressive and mobile-safe', () => {
    expect(source).toContain('COORDINATOR_OPERATING_FLOW')
    expect(source).toContain('Set structure')
    expect(source).toContain('Approve participants')
    expect(source).toContain('Publish schedule')
    expect(source).toContain('Review uploads and results')
    expect(source).toContain('operatingFlowGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(source).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps operating flow numbers readable in dark and light mode', () => {
    expect(source).toContain('const operatingFlowNumberStyle: CSSProperties')
    expect(source).toContain("background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'")
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
    expect(source).toContain('Coordinator-published schedule preview')
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

  it('keeps the shared coordinator subnav from forcing horizontal scroll', () => {
    expect(subnavSource).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))'")
    expect(styleBlock(subnavSource, 'linkStyle')).toContain('minWidth: 0')
    expect(styleBlock(subnavSource, 'linkLabelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(subnavSource).toContain("gridTemplateColumns: '30px minmax(0, 1fr) auto'")
    expect(styleBlock(subnavSource, 'gridStyle')).toContain('minWidth: 0')
  })
})
