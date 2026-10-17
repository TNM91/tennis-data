import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const universalSearch = read('app/components/universal-search.tsx')
const exploreSearch = read('app/explore/search/page.tsx')
const exploreHome = read('app/explore/page.tsx')
const playerProfileStory = read('app/players/[id]/player-profile-story.module.css')

describe('free Explore search', () => {
  it('sends an unmatched query to all-category search so area terms do not become player names', () => {
    expect(universalSearch).toContain('buildFreeTennisSearchHref(q)')
    expect(universalSearch).toContain('`/explore/search?scope=all&q=${encodeURIComponent(query.trim())}`')
    expect(universalSearch).toContain('function isLikelyPlayerLookupQuery')
    expect(universalSearch).toContain("filtered.filter((item) => item.result.group !== 'Actions')")
    expect(exploreSearch).toContain("searchLeagues(trimmedQuery, 'all')")
    expect(exploreSearch).toContain('playerMatches.value.usedSpellingHelp')
  })

  it('uses the indexed public player lookup instead of broad client-side player scans', () => {
    expect(exploreSearch).toContain("supabase.rpc('search_public_players'")
    expect(exploreSearch).toContain('players_name_trigram_search_idx')
    expect(exploreSearch).not.toContain(".ilike('name', pattern)")
    expect(exploreSearch).not.toContain(".ilike('location', pattern)")
    expect(exploreSearch).not.toContain('.limit(250)')
  })

  it('offers close player-name matches and puts the player result ahead of follow-up actions', () => {
    expect(exploreSearch).toContain("supabase.rpc('search_public_players'")
    expect(exploreSearch).toContain('Closest name matches')
    expect(exploreSearch.indexOf('sectionKicker}>Search results')).toBeLessThan(exploreSearch.lastIndexOf('{hasQuery ? searchNextActionsPanel : null}'))
    expect(exploreSearch).toContain('{!hasQuery ? (')
  })

  it('keeps an active search compact so player cards appear before secondary controls', () => {
    expect(exploreSearch).toContain("compact={hasQuery}")
    expect(exploreSearch).toContain('compactResultTabStyle')
    expect(exploreSearch).toContain("!hasQuery && scope === 'players'")
  })

  it('keeps the mobile player profile from becoming a horizontal scroll surface', () => {
    expect(playerProfileStory).toContain('overflow-x: clip')
    expect(playerProfileStory).toContain('overflow: hidden')
    expect(playerProfileStory).toContain('flex-wrap: wrap')
  })

  it('keeps Explore free while giving searchers a clear plan comparison path', () => {
    expect(exploreHome).toContain('Free to start')
    expect(exploreHome).toContain("getMembershipTier('free')")
    expect(exploreHome).toContain("href: '/pricing'")
  })
})
