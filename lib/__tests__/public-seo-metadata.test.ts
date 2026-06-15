import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRouteMetadata } from '../route-metadata'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const rootLayout = read('app/layout.tsx')
const routeMetadataSource = read('lib/route-metadata.ts')

describe('public SEO metadata', () => {
  const metadataRoutePattern =
    /metadata|getExploreMetadata|getRankingsMetadata|getMatchupMetadata|getTournamentMetadataById|buildRouteMetadata/
  const sharedMetadataPattern =
    /canonical|openGraph|twitter|buildRouteMetadata|getExploreMetadata|getRankingsMetadata|getMatchupMetadata|getTournamentMetadataById/

  it('lazy-initializes the metadata Supabase client for build safety', () => {
    expect(routeMetadataSource).toContain('let metadataSupabase')
    expect(routeMetadataSource).toContain('function getMetadataSupabase()')
    expect(routeMetadataSource).toContain('metadataSupabase = createClient')
    expect(routeMetadataSource).not.toContain('const supabase = createClient')
  })

  it('builds canonical and complete social metadata for shared public routes', () => {
    const metadata = buildRouteMetadata({
      title: 'Coaches',
      description: 'Find tennis coaching support and see how Coach Hub helps players and coaches keep development moving between lessons.',
      path: '/coaches',
    })

    expect(metadata.alternates).toMatchObject({ canonical: '/coaches' })
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      locale: 'en_US',
      siteName: 'TenAceIQ',
      title: 'Coaches',
      description: 'Find tennis coaching support and see how Coach Hub helps players and coaches keep development moving between lessons.',
      url: '/coaches',
    })
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Coaches',
      description: 'Find tennis coaching support and see how Coach Hub helps players and coaches keep development moving between lessons.',
    })
  })

  it('uses canonical Open Graph and Twitter metadata for core public routes', () => {
    for (const routeFile of [
      'app/page.tsx',
      'app/explore/layout.tsx',
      'app/explore/players/layout.tsx',
      'app/explore/teams/layout.tsx',
      'app/explore/leagues/layout.tsx',
      'app/explore/rankings/layout.tsx',
      'app/explore/search/layout.tsx',
      'app/explore/matchups/layout.tsx',
      'app/players/layout.tsx',
      'app/teams/layout.tsx',
      'app/leagues/layout.tsx',
      'app/rankings/layout.tsx',
      'app/matchup/layout.tsx',
      'app/coaches/page.tsx',
      'app/tournaments/page.tsx',
      'app/resources/page.tsx',
      'app/player-development/page.tsx',
      'app/data-assist/layout.tsx',
      'app/how-it-works/page.tsx',
      'app/methodology/page.tsx',
      'app/about/page.tsx',
      'app/faq/page.tsx',
      'app/contact/page.tsx',
      'app/tournaments/[id]/layout.tsx',
      'app/advertising-disclosure/page.tsx',
      'app/legal/privacy/page.tsx',
      'app/legal/terms/page.tsx',
      'app/legal/billing/page.tsx',
      'app/legal/cookies/page.tsx',
      'app/legal/disclaimer/page.tsx',
      'app/legal/data-policy/page.tsx',
      'app/legal/copyright/page.tsx',
      'app/pricing/layout.tsx',
    ]) {
      const source = read(routeFile)
      expect(source).toMatch(metadataRoutePattern)
      expect(source).toMatch(sharedMetadataPattern)
    }
  })

  it('keeps Pricing on the shared route metadata helper for canonical and social cards', () => {
    const pricingLayout = read('app/pricing/layout.tsx')

    expect(pricingLayout).toContain('buildRouteMetadata')
    expect(pricingLayout).toContain("path: '/pricing'")
  })

  it('keeps new public sections on the shared metadata helper with OG images', () => {
    for (const [routeFile, path] of [
      ['app/coaches/page.tsx', '/coaches'],
      ['app/tournaments/page.tsx', '/tournaments'],
      ['app/resources/page.tsx', '/resources'],
      ['app/player-development/page.tsx', '/player-development'],
      ['app/data-assist/layout.tsx', '/data-assist'],
      ['app/explore/players/layout.tsx', '/explore/players'],
      ['app/explore/teams/layout.tsx', '/explore/teams'],
      ['app/explore/leagues/layout.tsx', '/explore/leagues'],
      ['app/explore/rankings/layout.tsx', '/explore/rankings'],
      ['app/explore/search/layout.tsx', '/explore/search'],
      ['app/how-it-works/page.tsx', '/how-it-works'],
      ['app/methodology/page.tsx', '/methodology'],
      ['app/about/page.tsx', '/about'],
      ['app/faq/page.tsx', '/faq'],
      ['app/contact/page.tsx', '/contact'],
      ['app/advertising-disclosure/page.tsx', '/advertising-disclosure'],
      ['app/legal/privacy/page.tsx', '/legal/privacy'],
      ['app/legal/terms/page.tsx', '/legal/terms'],
      ['app/legal/billing/page.tsx', '/legal/billing'],
      ['app/legal/cookies/page.tsx', '/legal/cookies'],
      ['app/legal/disclaimer/page.tsx', '/legal/disclaimer'],
      ['app/legal/data-policy/page.tsx', '/legal/data-policy'],
      ['app/legal/copyright/page.tsx', '/legal/copyright'],
    ] as const) {
      const source = read(routeFile)

      expect(source).toContain('buildRouteMetadata')
      expect(source).toContain(`path: '${path}'`)
      expect(source).not.toContain('openGraph: {')
      expect(source).not.toContain('twitter: {')
    }
  })

  it('keeps Matchup on its canonical social metadata helper', () => {
    const matchupLayout = read('app/matchup/layout.tsx')
    const exploreMatchupsLayout = read('app/explore/matchups/layout.tsx')

    expect(matchupLayout).toContain('getMatchupMetadata')
    expect(exploreMatchupsLayout).toContain('getMatchupMetadata')
    expect(routeMetadataSource).toContain('export function getMatchupMetadata()')
    expect(routeMetadataSource).toContain("path: '/matchup'")
    expect(routeMetadataSource).toContain("title: 'Matchup Analysis'")
  })

  it('keeps tournament detail pages shareable with dynamic canonical metadata', () => {
    const tournamentDetailLayout = read('app/tournaments/[id]/layout.tsx')

    expect(tournamentDetailLayout).toContain('generateMetadata')
    expect(tournamentDetailLayout).toContain('getTournamentMetadataById')
    expect(routeMetadataSource).toContain('export function getTournamentMetadataById')
    expect(routeMetadataSource).toContain('path: `/tournaments/${encodeURIComponent(id)}`')
  })

  it('keeps root metadata aligned to public workspace names', () => {
    for (const phrase of ['PLATFORM_POSITIONING', 'tennis platform', 'tennis resource hub', 'tennis management platform']) {
      expect(rootLayout).toContain(phrase)
    }

    expect(rootLayout).toContain('const SITE_DESCRIPTION = `${PRODUCT_MOTTO} ${PLATFORM_POSITIONING}`')
    expect(rootLayout).toContain('SITE_DESCRIPTION')
    expect(rootLayout).not.toContain('captain workspace')
    expect(rootLayout).not.toContain('Captain decisions')
    expect(rootLayout).not.toContain('League operations, or the Full-Court suite')
  })
})
