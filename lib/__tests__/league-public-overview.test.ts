import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/leagues/[league]/page.tsx'), 'utf8')

describe('league public overview', () => {
  it('keeps public league detail focused on compact standings and match previews', () => {
    expect(source).toContain('const standingsPreviewLimit = isMobile ? 6 : 12')
    expect(source).toContain('const visibleTeamSummaries = showAllTeams ? teamSummaries : teamSummaries.slice(0, standingsPreviewLimit)')
    expect(source).toContain('Show all ${teamSummaries.length} teams')
    expect(source).toContain('const matchPreviewLimit = isMobile ? 4 : 8')
    expect(source).toContain('const visibleMatches = showFullMatchHistory ? filteredMatches : filteredMatches.slice(0, matchPreviewLimit)')
    expect(source).toContain('Show all ${filteredMatches.length} matches')
  })

  it('keeps Captain-only actions out of the public league path', () => {
    expect(source).toContain('const canUseCaptainTools = authResolved && access.canUseCaptainWorkflow')
    expect(source).toContain('{canUseCaptainTools && captainActionLinks.length > 0 ? (')
    expect(source).toContain("...(canUseCaptainTools ? ['Lineup'] : [])")
    expect(source).toContain("{!canUseCaptainTools && leagueFormat === 'team' ? (")
    expect(source).toContain('Get the lineup ready before match day.')
  })
})
