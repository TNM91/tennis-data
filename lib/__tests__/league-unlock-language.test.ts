import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const leagueWorkspaceSource = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')
const teamResultsSource = readFileSync(join(process.cwd(), 'app/components/team-league-results-workspace.tsx'), 'utf8')
const individualResultsSource = readFileSync(join(process.cwd(), 'app/components/individual-league-results-workspace.tsx'), 'utf8')
const competeTeamsSource = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')
const tiqLeagueDetailSource = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')
const productStorySource = readFileSync(join(process.cwd(), 'lib/product-story.ts'), 'utf8')
const leagueLayoutSource = readFileSync(join(process.cwd(), 'app/league-coordinator/layout.tsx'), 'utf8')
const seasonDashboardLayoutSource = readFileSync(join(process.cwd(), 'app/captain/season-dashboard/layout.tsx'), 'utf8')
const captainTeamMatchesSource = readFileSync(join(process.cwd(), 'app/captain/tiq-team-matches/page.tsx'), 'utf8')
const leagueResultsRouteSource = readFileSync(join(process.cwd(), 'app/league-coordinator/results/page.tsx'), 'utf8')
const individualResultsRouteSource = readFileSync(join(process.cwd(), 'app/league-coordinator/individual-results/page.tsx'), 'utf8')

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

  it('uses League Office wording in user-facing locked result prompts', () => {
    expect(teamResultsSource).toContain('Unlock League Office to enter team match results')
    expect(individualResultsSource).toContain('Unlock League Office to enter player results')
    expect(teamResultsSource).toContain('Checking League Office access')
    expect(teamResultsSource).toContain('League Office result entry is not active for this account.')
    expect(teamResultsSource).toContain('Result entry unlocks with Team League Office access.')
    expect(individualResultsSource).toContain('Checking League Office access')
    expect(individualResultsSource).toContain('League Office access is required before logging individual results.')
    expect(individualResultsSource).toContain('Result entry unlocks with Individual League Office access.')
    expect(teamResultsSource).not.toContain('Unlock TIQ League Coordinator to enter')
    expect(individualResultsSource).not.toContain('Unlock TIQ League Coordinator to enter')
    expect(teamResultsSource).not.toContain('Coordinator result entry is not active')
    expect(teamResultsSource).not.toContain('Checking Coordinator access')
    expect(teamResultsSource).not.toContain('team-league Coordinator access')
    expect(individualResultsSource).not.toContain('Coordinator access is required before logging individual results')
    expect(individualResultsSource).not.toContain('Checking Coordinator access')
    expect(individualResultsSource).not.toContain('individual-league Coordinator access')
    expect(leagueWorkspaceSource).toContain('League access is not active yet.')
    expect(leagueWorkspaceSource).toContain('Unlock League access to save League Office seasons.')
    expect(leagueWorkspaceSource).toContain('League Office is active.')
    expect(leagueWorkspaceSource).toContain('Create the first League Office season.')
    expect(leagueWorkspaceSource).toContain('Set up the first League Office season.')
    expect(leagueWorkspaceSource).toContain('This League Office tool is still using saved preview data until live sync is available.')
    expect(leagueWorkspaceSource).toContain("href: records.length > 0 ? '/leagues' : '#league-setup-form'")
    expect(leagueWorkspaceSource).toContain("cta: records.length > 0 ? 'View public leagues' : 'Create first'")
    expect(leagueWorkspaceSource).not.toContain('League workspace is active.')
    expect(leagueWorkspaceSource).not.toContain('League workspace data could not load.')
    expect(leagueWorkspaceSource).not.toContain('Unlock League access to save League Office workspaces.')
    expect(leagueWorkspaceSource).not.toContain('Set up the first League Office workspace.')
    expect(leagueWorkspaceSource).not.toContain('open the workspace that removes the most admin work')
    expect(leagueWorkspaceSource).not.toContain('Bring participant lists into the workspace')
    expect(leagueWorkspaceSource).not.toContain('Use the correct workspace:')
    expect(leagueWorkspaceSource).not.toContain('League lane.')
    expect(productStorySource).toContain('League Office gives organizers one place for participants')
  })

  it('keeps public League upgrade CTAs short and tier-aligned', () => {
    for (const source of [competeTeamsSource, tiqLeagueDetailSource]) {
      expect(source).toContain('ctaLabel="Unlock League"')
      expect(source).not.toContain('ctaLabel="Run Your League on TIQ"')
    }
    expect(productStorySource).toContain("cta: 'Unlock League'")
    expect(productStorySource).not.toContain('Run Your League on TIQ')
  })

  it('uses League Office labels on private League surfaces and fallbacks', () => {
    expect(tiqLeagueDetailSource).toContain('Open League Office')
    expect(tiqLeagueDetailSource).toContain('League Office-set schedule')
    expect(tiqLeagueDetailSource).toContain('opening League Office for updates')
    expect(tiqLeagueDetailSource).toContain('League Office records player results')
    expect(tiqLeagueDetailSource).toContain('League Office context')
    expect(tiqLeagueDetailSource).toContain('Submit your team for League Office approval')
    expect(tiqLeagueDetailSource).toContain('Submit your player entry for League Office approval')
    expect(tiqLeagueDetailSource).toContain('Waiting for League Office approval')
    expect(tiqLeagueDetailSource).toContain('League Office Required')
    expect(tiqLeagueDetailSource).not.toContain('Open League Coordinator')
    expect(tiqLeagueDetailSource).not.toContain('Coordinator-set schedule')
    expect(tiqLeagueDetailSource).not.toContain('opening Coordinator for updates')
    expect(tiqLeagueDetailSource).not.toContain('Coordinator access records player results')
    expect(tiqLeagueDetailSource).not.toContain('Coordinator context')
    expect(tiqLeagueDetailSource).not.toContain('coordinator approval')
    expect(tiqLeagueDetailSource).not.toContain('Coordinator Required')

    for (const source of [leagueLayoutSource, seasonDashboardLayoutSource]) {
      expect(source).toContain('League Office | TenAceIQ')
      expect(source).toContain('Use League Office')
      expect(source).not.toContain('League Coordinator | TenAceIQ')
      expect(source).not.toContain('Use TIQ League Coordinator')
    }
  })

  it('keeps result-entry login handoffs on the League Office path', () => {
    for (const source of [teamResultsSource, individualResultsSource]) {
      expect(source).toContain("import { buildAuthEntryHref } from '@/lib/auth-entry-hrefs'")
      expect(source).toContain("loginPlanId = 'league'")
      expect(source).toContain("router.replace(buildAuthEntryHref('/login', loginPlanId, buildCurrentLoginNextHref(loginNextHref), true))")
      expect(source).not.toContain('router.replace(`/login?next=${encodeURIComponent(buildCurrentLoginNextHref(loginNextHref))}`)')
    }

    expect(captainTeamMatchesSource).toContain('loginNextHref="/captain/tiq-team-matches"')
    expect(captainTeamMatchesSource).toContain('loginPlanId="league"')
    expect(leagueResultsRouteSource).toContain('loginPlanId="league"')
    expect(individualResultsRouteSource).toContain('loginPlanId="league"')
  })
})
