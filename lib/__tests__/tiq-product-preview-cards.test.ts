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

  it('uses product-path preview language instead of sample record names', () => {
    for (const copy of [
      'Scout the next match',
      'Build the team week',
      'Assign the next drill',
      'Run the event desk',
      'Keep standings current',
    ]) {
      expect(commandCenterSource).toContain(copy)
      expect(source).toContain(copy)
    }

    expect(commandCenterSource).toContain('See what each path actually does.')
    expect(commandCenterSource).toContain('Each preview shows the decision it supports, the signal it reads, and the next tennis action.')

    for (const staleCopy of [
      'Rivera vs Brooks',
      'Saturday vs West County',
      'Ava M.',
      'Summer Doubles Classic',
      'Spring Ladder',
      'Useful tennis tools for the next action.',
      'Preview cards keep each tool concrete',
    ]) {
      expect(commandCenterSource).not.toContain(staleCopy)
      expect(source).not.toContain(staleCopy)
    }
  })

  it('keeps the public command-center cards compact instead of overly rounded', () => {
    expect(commandCenterSource).toContain('const actionCardStyle: CSSProperties')
    expect(commandCenterSource).toContain('const heroCopyStyle: CSSProperties')
    expect(commandCenterSource).toContain('const heroPanelStyle: CSSProperties')
    expect(commandCenterSource).not.toContain('const miniCourtStyle: CSSProperties')
    expect(commandCenterSource).toContain('borderRadius: 8')
    expect(commandCenterSource).not.toContain('borderRadius: 22')
    expect(commandCenterSource).not.toContain('borderRadius: 28')
  })

  it('turns the homepage hero panel into a concise action board instead of a repetitive path preview', () => {
    expect(commandCenterSource).toContain('const heroBoardActions')
    expect(commandCenterSource).toContain('Quick actions')
    expect(commandCenterSource).toContain('Pick the job, then move.')
    expect(commandCenterSource).toContain('Search when you know the name.')
    expect(commandCenterSource).not.toContain('Platform paths')
    expect(commandCenterSource).not.toContain('Explore, improve, compete, manage, or fix tennis context.')
    expect(commandCenterSource).not.toContain('Start with what you need to do.')
    expect(commandCenterSource).toContain("{ label: 'Fix Data', detail: 'Scorecards and rosters', href: DATA_ASSIST_STORY.href }")
    expect(commandCenterSource).toContain('heroBoardGridStyle')
    expect(commandCenterSource).toContain('heroBoardActionStyle')
    expect(commandCenterSource).not.toContain('aria-label="TenAceIQ portal board preview"')
    expect(commandCenterSource).not.toContain('<div style={miniCourtStyle}')
  })
})
