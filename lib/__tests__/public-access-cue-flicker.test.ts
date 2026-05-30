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
      'app/leagues/page.tsx',
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
    const exploreSearchSource = readAppFile('app/explore/search/page.tsx')
    const exploreLeaguesSource = readAppFile('app/explore/leagues/page.tsx')

    expect(teamsSource).not.toContain('UpgradePrompt')
    expect(rankingsSource).not.toContain('UpgradePrompt')
    expect(playersSource).not.toContain('UpgradePrompt')
    expect(matchupSource).toContain('authResolved && !access.canUseAdvancedPlayerInsights')
    expect(exploreSearchSource).not.toContain('UpgradePrompt')
    expect(exploreLeaguesSource).not.toContain('UpgradePrompt')
  })

  it('keeps auth-dependent discovery surfaces on the shared auth provider', () => {
    for (const path of [
      'app/explore/leagues/tiq/[league]/page.tsx',
      'app/matchup/page.tsx',
      'app/players/page.tsx',
      'app/rankings/page.tsx',
      'app/teams/page.tsx',
    ]) {
      const source = readAppFile(path)
      expect(source).toMatch(/use(ProductAccess|Auth)\(\)/)
      expect(source).not.toContain('getClientAuthState')
      expect(source).not.toContain('ProductEntitlementSnapshot')
    }
  })

  it('keeps TIQ league detail paid cues neutral until auth resolves', () => {
    const source = readAppFile('app/explore/leagues/tiq/[league]/page.tsx')
    expect(source).toContain('function TiqLeagueDetailContent()')
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain("const resolvedRole = authResolved || !userId ? role : 'member'")
    expect(source).toContain('buildProductAccessState(resolvedRole, entitlements)')
    expect(source).toContain('authResolved && !access.canUseAdvancedPlayerInsights')
    expect(source).toContain("authResolved && league.leagueFormat === 'team' && !entryEnabled")
    expect(source).toContain('authResolved && !canLogIndividualResults')
  })

  it('keeps compete paid prompts neutral until auth resolves', () => {
    for (const path of [
      'app/compete/teams/page.tsx',
      'app/compete/schedule/page.tsx',
      'app/compete/results/page.tsx',
    ]) {
      const source = readAppFile(path)
      expect(source).toContain('const { role, userId, entitlements, authResolved } = useAuth()')
      expect(source).toContain("const resolvedRole = authResolved || !userId ? role : 'member'")
      expect(source).toContain('buildProductAccessState(resolvedRole, entitlements)')
      expect(source).toContain('authResolved')
    }
  })

  it('keeps player surfaces neutral until auth resolves', () => {
    const profileSource = readAppFile('app/players/[id]/page.tsx')
    const myLabSource = readAppFile('app/mylab/page.tsx')

    expect(profileSource).toContain('function PlayerProfileContent()')
    expect(profileSource).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(profileSource).toContain("const resolvedRole = authResolved || !currentUserId ? role : 'member'")
    expect(profileSource).toContain('buildProductAccessState(resolvedRole, entitlements)')
    expect(profileSource).toContain(') : authResolved ? (')
    expect(profileSource).not.toContain('getClientAuthState')
    expect(profileSource).not.toContain('ProductEntitlementSnapshot')

    expect(myLabSource).toContain("const resolvedRole = authResolved || !userId ? role : 'member'")
    expect(myLabSource).toContain('buildProductAccessState(resolvedRole, entitlements)')
    expect(myLabSource).toContain('const accessPending = !authResolved || (Boolean(userId) && entitlements === null)')
    expect(myLabSource).toContain('!accessPending && !access.canUseAdvancedPlayerInsights')
  })

  it('keeps upgrade access state on the shared auth provider', () => {
    const source = readAppFile('app/upgrade/page.tsx')
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('const { role, userId, entitlements, authResolved, session, refreshAuth } = useAuth()')
    expect(source).toContain("const resolvedRole = authResolved || !userId ? role : 'member'")
    expect(source).toContain('const authLoading = !authResolved')
    expect(source).toContain('buildProductAccessState(resolvedRole, entitlements)')
    expect(source).toContain('await refreshAuth()')
    expect(source).not.toContain('getClientAuthState')
    expect(source).not.toContain('ProductEntitlementSnapshot')
  })
})
