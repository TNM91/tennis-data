import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('league coordinator action deduplication', () => {
  it('keeps shared scheduler and season readiness focused on one next move', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
      'utf8',
    )

    expect(source).toContain('sharedSchedulerNextMove')
    expect(source).toContain('sharedCalendarNextMoveStyle')
    expect(source).toContain('sharedCalendarStepGridStyle')
    expect(source).toContain('leagueOfficeOperationProofStyle')
    expect(source).toContain('<GhostLink href="#league-setup-form">Pending dates</GhostLink>')
    expect(source).toContain('<GhostLink href="/compete/schedule">Confirmed calendar</GhostLink>')
    expect(source).toContain('<GhostLink href={resultEntryHref}>Post results</GhostLink>')

    const sharedSchedulerSection = source.slice(
      source.indexOf('<section id="shared-calendar"'),
      source.indexOf('<details style={dataAssistOpsPanelStyle}>'),
    )
    const seasonReadinessSection = source.slice(
      source.indexOf('<section style={leagueOpsPanelStyle}>'),
      source.indexOf('<div style={responsiveLayoutGrid}>'),
    )

    expect(sharedSchedulerSection).not.toContain('responsiveHeroActionRowStyle')
    expect(sharedSchedulerSection).not.toContain('<GhostLink href="/compete/leagues">View leagues</GhostLink>')
    expect(sharedSchedulerSection).not.toContain('<GhostLink href="/explore/rankings">View rankings</GhostLink>')
    expect(seasonReadinessSection).not.toContain('responsiveHeroActionRowStyle')
    expect(seasonReadinessSection).not.toContain('leagueOpsChecks.map')
  })

  it('keeps the empty league registry actionable', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
      'utf8',
    )

    expect(source).toContain('function EmptyLeagueRegistryPanel')
    expect(source).toContain('League operations start with one season shell.')
    expect(source).toContain('Create league')
    expect(source).toContain('Upload season data')
    expect(source).toContain('League directory')
    expect(source).not.toContain('No TIQ leagues have been created yet. Start with a team league or an individual league')
    expect(source).toContain('emptyRegistryPanelStyle')
    expect(source).toContain('emptyRegistryActionRowStyle')
    expect(source).toContain('emptyRegistryActionStyle')
  })

  it('keeps the league setup form oriented before the long field list', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
      'utf8',
    )

    expect(source).toContain('setupFocusItems')
    expect(source).toContain('aria-label="League setup focus"')
    expect(source).toContain('Setup focus')
    expect(source).toContain('Build only what the season needs next.')
    expect(source).toContain('Review the league before updating it.')
    expect(source).toContain("label: 'Format'")
    expect(source).toContain("label: 'Season'")
    expect(source).toContain("label: 'Schedule'")
    expect(source).toContain('draftParticipantCount')
    expect(source).toContain('setupFocusPanelStyle')
    expect(source).toContain('setupFocusGridStyle')
    expect(source).toContain('setupFocusItemReadyStyle')
  })

  it('keeps public page empty readiness actionable', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
      'utf8',
    )

    expect(source).toContain('function EmptyPublicReadinessPanel')
    expect(source).toContain('Public pages start after one league is saved.')
    expect(source).toContain('No pages match this view.')
    expect(source).toContain('Preview league lane')
    expect(source).toContain('Show all pages')
    expect(source).not.toContain('No TIQ league pages are ready yet. Save a team or individual league to start.')
    expect(source).not.toContain('No public league pages match this filter.')
    expect(source).toContain('id="league-public-pages"')
    expect(source).toContain('emptyPublicReadinessPanelStyle')
    expect(source).toContain('emptyPublicReadinessActionRowStyle')
  })

  it('keeps team result book metrics action-oriented before standings exist', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
      'utf8',
    )

    expect(source).toContain('Standings start after results')
    expect(source).not.toContain('No standings yet')
  })

  it('keeps the empty join request queue useful', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
      'utf8',
    )

    expect(source).toContain('function EmptyJoinRequestPanel')
    expect(source).toContain('No join requests are waiting.')
    expect(source).toContain('Check public pages')
    expect(source).toContain('Share league lane')
    expect(source).toContain('Review setup')
    expect(source).not.toContain('No join requests are waiting right now.')
    expect(source).toContain('emptyJoinRequestPanelStyle')
    expect(source).toContain('emptyJoinRequestActionRowStyle')
  })
})
