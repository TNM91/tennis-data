import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readAppFile(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('public access cue flicker guards', () => {
  it('waits for access resolution before rendering sponsored placements', () => {
    for (const path of [
      'app/explore/page.tsx',
      'app/teams/page.tsx',
      'app/rankings/page.tsx',
      'app/players/page.tsx',
      'app/matchup/page.tsx',
    ]) {
      const source = readAppFile(path)
      expect(source).toContain('authResolved')
      expect(source).toContain('const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)')
      expect(source).not.toContain('const shouldShowAds = shouldShowSponsoredPlacements(access)')
    }
  })

  it('does not show discovery upsells before auth state settles', () => {
    const teamsSource = readAppFile('app/teams/page.tsx')
    const rankingsSource = readAppFile('app/rankings/page.tsx')
    const playersSource = readAppFile('app/players/page.tsx')
    const matchupSource = readAppFile('app/matchup/page.tsx')

    expect(teamsSource).toContain('authResolved && (!access.canUseCaptainWorkflow || !access.canUseLeagueTools)')
    expect(rankingsSource).toContain('authResolved && !access.canUseAdvancedPlayerInsights')
    expect(playersSource).toContain('authResolved && !access.canUseAdvancedPlayerInsights')
    expect(matchupSource).toContain('authResolved && !access.canUseAdvancedPlayerInsights')
  })
})
