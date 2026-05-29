import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('public loading state polish', () => {
  it('keeps the Players directory loading view useful instead of raw loading copy', () => {
    const playersSource = read('app/players/page.tsx')

    expect(playersSource).toContain('Player discovery')
    expect(playersSource).toContain('Start with a player search.')
    expect(playersSource).toContain('The reviewed player layer is refreshing behind this starter view.')
    expect(playersSource).not.toContain('Directory loading')
  })

  it('uses intentional route fallback labels on public pages', () => {
    for (const path of [
      'app/loading.tsx',
      'app/players/loading.tsx',
      'app/players/[id]/loading.tsx',
      'app/teams/[team]/loading.tsx',
      'app/leagues/[league]/loading.tsx',
      'app/rankings/loading.tsx',
      'app/matchup/loading.tsx',
      'app/explore/loading.tsx',
      'app/explore/teams/loading.tsx',
      'app/explore/leagues/loading.tsx',
      'app/explore/rankings/loading.tsx',
      'app/explore/search/loading.tsx',
      'app/explore/matchups/loading.tsx',
      'app/pricing/loading.tsx',
    ]) {
      const source = read(path)
      expect(source).not.toContain('label="Loading')
      expect(source).toContain('label="Preparing')
    }
  })

  it('keeps Matchup empty player selectors from saying no active players', () => {
    const matchupSource = read('app/matchup/page.tsx')

    expect(matchupSource).toContain('Players appear after review')
    expect(matchupSource).not.toContain('No active players')
  })

  it('keeps rankings, teams, and leagues from leading with raw zero-state counts', () => {
    const rankingsSource = read('app/rankings/page.tsx')
    const teamsSource = read('app/teams/page.tsx')
    const leaguesSource = read('app/leagues/page.tsx')

    expect(rankingsSource).toContain('Search to build the board')
    expect(rankingsSource).toContain('Board starts after verified context')
    expect(rankingsSource).toContain('Location filters appear after review')
    expect(rankingsSource).not.toContain('Showing {rankedPlayers.length}')
    expect(teamsSource).toContain('Search for a team or browse by league.')
    expect(teamsSource).not.toContain('Teams are not available yet')
    expect(leaguesSource).toContain('Choose a league path.')
    expect(leaguesSource).toContain('Source pending review')
    expect(leaguesSource).not.toContain('League records are not available yet.')
    expect(leaguesSource).not.toContain("row.source || 'Unknown'")
  })
})
