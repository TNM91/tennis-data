import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const home = read('app/explore/page.tsx')
const continueCard = read('app/explore/_components/explore-continue-card.tsx')
const tracker = read('app/explore/_components/explore-resume-tracker.tsx')
const search = read('app/explore/search/page.tsx')
const players = read('app/players/page.tsx')
const teams = read('app/teams/page.tsx')
const leagues = read('app/explore/leagues/page.tsx')
const rankings = read('app/rankings/page.tsx')
const player = read('app/players/[id]/page.tsx')
const team = read('app/teams/[team]/page.tsx')
const league = read('app/leagues/[league]/page.tsx')
const route = read('app/api/explore/resume/route.ts')
const migration = read('supabase/migrations/20260803000600_create_explore_workspace_preferences.sql')

describe('Explore active-work continuity', () => {
  it('stores owner-scoped cloud resume state', () => {
    expect(route).toContain(".from('explore_workspace_preferences')")
    expect(route).toContain('getResumeAuth')
    expect(migration).toContain('create table if not exists public.explore_workspace_preferences')
    expect(migration).toContain('auth.uid() = user_id')
  })

  it('puts one clear Continue action on Explore home', () => {
    expect(home).toContain('<ExploreContinueCard />')
    expect(continueCard).toContain('getExploreResumeHref')
    expect(continueCard).toContain('>Continue</small>')
    expect(continueCard).toContain('href={href}')
  })

  it('restores exact search and directory filters', () => {
    expect(tracker).toContain('syncExploreResumeState')
    for (const source of [search, players, teams, leagues, rankings]) {
      expect(source).toContain('window.history.replaceState')
      expect(source).toContain('<ExploreResumeTracker')
    }
    expect(search).toContain("params.set('scope', scope)")
    expect(players).toContain("params.set('sort', sortBy)")
    expect(teams).toContain("params.set('league', leagueFilter)")
    expect(leagues).toContain("params.set('layer', layerFilter)")
    expect(rankings).toContain("params.set('rating', ratingView)")
  })

  it('tracks exact player, team, and league details', () => {
    expect(player).toContain('surface="player"')
    expect(player).toContain('contextLabel={player.name}')
    expect(player).toContain("query.set('window', chartWindow)")
    expect(player).toContain('window.history.replaceState')
    expect(team).toContain('surface="team"')
    expect(team).toContain('contextLabel={team}')
    expect(team).toContain("query.set('roster', rosterFilter)")
    expect(team).toContain('window.history.replaceState')
    expect(league).toContain('surface="league"')
    expect(league).toContain('buildLeagueScopeHref')
    expect(league).toContain("params.set('view', view)")
    expect(league).toContain('window.history.replaceState')
  })
})
