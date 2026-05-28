import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const leagueWorkspaceSource = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')
const teamResultsSource = readFileSync(join(process.cwd(), 'app/components/team-league-results-workspace.tsx'), 'utf8')
const individualResultsSource = readFileSync(join(process.cwd(), 'app/components/individual-league-results-workspace.tsx'), 'utf8')
const competeTeamsSource = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')
const tiqLeagueDetailSource = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')
const productStorySource = readFileSync(join(process.cwd(), 'lib/product-story.ts'), 'utf8')

describe('League unlock language', () => {
  it('uses the visible League mode for locked tool CTAs and state labels', () => {
    for (const source of [teamResultsSource, individualResultsSource]) {
      expect(source).toContain('ctaLabel="Unlock League"')
      expect(source).toContain('secondaryLabel="Back to League"')
      expect(source).toContain('Need to record')
      expect(source).not.toContain('ctaLabel="Unlock Coordinator"')
      expect(source).not.toContain('Coordinator results locked')
    }
  })

  it('keeps formal TIQ League Coordinator wording available in explanatory plan copy', () => {
    expect(teamResultsSource).toContain('Unlock TIQ League Coordinator')
    expect(individualResultsSource).toContain('Unlock TIQ League Coordinator')
    expect(leagueWorkspaceSource).toContain('League access is not active yet.')
    expect(leagueWorkspaceSource).toContain('Unlock League access to save league workspaces.')
  })

  it('keeps public League upgrade CTAs short and tier-aligned', () => {
    for (const source of [competeTeamsSource, tiqLeagueDetailSource]) {
      expect(source).toContain('ctaLabel="Unlock League"')
      expect(source).not.toContain('ctaLabel="Run Your League on TIQ"')
    }
    expect(productStorySource).toContain("cta: 'Unlock League'")
    expect(productStorySource).not.toContain('Run Your League on TIQ')
  })
})
