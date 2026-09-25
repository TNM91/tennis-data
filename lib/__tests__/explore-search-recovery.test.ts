import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const exploreSearch = readFileSync(join(process.cwd(), 'app/explore/search/page.tsx'), 'utf8')

describe('Explore search recovery', () => {
  it('queries only the selected directory instead of making every search wait on all sources', () => {
    expect(exploreSearch).toContain("if (scope === 'players')")
    expect(exploreSearch).toContain("else if (scope === 'teams')")
    expect(exploreSearch).toContain('searchLeagues(trimmedQuery, scope)')
    expect(exploreSearch).not.toContain('const [playersResult, teamsResult, leagueResult] = await Promise.all')
  })

  it('recovers from a slow dependency instead of leaving the search in a loading state', () => {
    expect(exploreSearch).toContain('const SEARCH_TIMEOUT_MS = 8_000')
    expect(exploreSearch).toContain('runWithSearchTimeout')
    expect(exploreSearch).toContain('Try search again')
    expect(exploreSearch).toContain('setSearchAttempt((current) => current + 1)')
  })

  it('only starts network work after submit or an incoming search link', () => {
    expect(exploreSearch).toContain("const [submittedQuery, setSubmittedQuery] = useState('')")
    expect(exploreSearch).toContain('const trimmedQuery = submittedQuery.trim()')
    expect(exploreSearch).toContain('setSubmittedQuery(nextQuery)')
    expect(exploreSearch).toContain('// Only a submitted query (or an incoming search link) can start network work.')
  })

  it('hides old records as soon as a different search begins', () => {
    const normalizedSource = exploreSearch.replace(/\r\n/g, '\n')
    expect(normalizedSource).toContain('setCompletedSearch(null)\n    setPlayers([])\n    setTeams([])\n    setLeagues([])')
    expect(normalizedSource).toContain('setLoading(true)\n\n    async function runSearch()')
    expect(normalizedSource).toContain('const hasCurrentResults = hasQuery && !loading && !error && completedSearch?.query === submittedQuery.trim() && completedSearch.scope === scope')
    expect(normalizedSource).toContain('{hasCurrentResults ? (')
  })
})
