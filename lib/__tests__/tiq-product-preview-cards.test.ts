import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/tiq-product-preview-cards.tsx'), 'utf8')
const commandCenterSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')

describe('TIQ product preview cards', () => {
  it('exports reusable preview components for the command-center surfaces', () => {
    for (const componentName of [
      'TiqEntityCard',
      'TiqActionCard',
      'TiqWorkspacePreview',
      'TiqConfidenceChip',
      'TiqSourceFreshnessChip',
      'TiqEmptyState',
      'TiqMatchupCard',
      'TiqLineupPreview',
      'TiqCoachAssignmentCard',
      'TiqTournamentDrawCard',
      'TiqLeagueStandingCard',
      'TiqResourceCard',
    ]) {
      expect(source).toContain(`export function ${componentName}`)
    }
  })

  it('keeps cards compact, tracked, trust-aware, and mobile-safe', () => {
    expect(source).toContain('TrackedProductLink')
    expect(source).toContain('gridTemplateColumns: \'repeat(auto-fit, minmax(min(100%, 120px), 1fr))\'')
    expect(source).toContain('borderRadius: 8')
    expect(source).toContain('overflowWrap: \'anywhere\'')
    expect(source).toContain('Source: {source} | Freshness: {freshness}')
  })

  it('uses semantic labels and metric lists for reusable preview cards', () => {
    expect(source).toContain('aria-labelledby={titleId}')
    expect(source).toContain('aria-describedby={bodyId}')
    expect(source).toContain('ariaLabel={`${cta}: ${title}`}')
    expect(source).toContain('ariaLabel={`${action.label}: ${title}`}')
    expect(source).toContain('<dl style={metricGridStyle}')
    expect(source).toContain('<dt>{metric.label}</dt>')
    expect(source).toContain('<dd style={metricValueStyle}>{metric.value}</dd>')
    expect(source).toContain('slugifyForId')
  })

  it('powers the homepage product preview grid with named tennis cards', () => {
    expect(commandCenterSource).toContain('TiqMatchupCard')
    expect(commandCenterSource).toContain('TiqLineupPreview')
    expect(commandCenterSource).toContain('TiqCoachAssignmentCard')
    expect(commandCenterSource).toContain('TiqTournamentDrawCard')
    expect(commandCenterSource).toContain('TiqLeagueStandingCard')
    expect(commandCenterSource).toContain('renderPreviewCard(card)')
  })

  it('keeps the public command-center cards compact instead of overly rounded', () => {
    expect(commandCenterSource).toContain('const actionCardStyle: CSSProperties')
    expect(commandCenterSource).toContain('const heroCopyStyle: CSSProperties')
    expect(commandCenterSource).toContain('const heroPanelStyle: CSSProperties')
    expect(commandCenterSource).toContain('const miniCourtStyle: CSSProperties')
    expect(commandCenterSource).toContain('borderRadius: 8')
    expect(commandCenterSource).not.toContain('borderRadius: 22')
    expect(commandCenterSource).not.toContain('borderRadius: 28')
  })

  it('turns the homepage hero panel into an action board instead of an empty court frame', () => {
    expect(commandCenterSource).toContain('const heroBoardActions')
    expect(commandCenterSource).toContain('Platform paths')
    expect(commandCenterSource).toContain('Start with what you need to do.')
    expect(commandCenterSource).toContain('Explore, improve, compete, manage, or fix tennis context.')
    expect(commandCenterSource).toContain("{ label: 'Fix Tennis Info', detail: 'Scorecards, schedules, rosters', href: DATA_ASSIST_STORY.href }")
    expect(commandCenterSource).toContain('heroBoardGridStyle')
    expect(commandCenterSource).toContain('heroBoardActionStyle')
    expect(commandCenterSource).toContain('aria-label="TenAceIQ portal board preview"')
    expect(commandCenterSource).not.toContain('<div style={miniCourtStyle} aria-hidden="true">')
  })
})
