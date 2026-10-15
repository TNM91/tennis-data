import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeagueSummaryPayload } from '../league-summary'

const mocks = vi.hoisted(() => ({ summary: vi.fn() }))
vi.mock('../league-summary-server', () => ({ getCachedLeagueSummary: mocks.summary }))
vi.mock('../route-metadata', () => ({ buildRouteMetadata: (value: unknown) => value }))
vi.mock('@/app/components/site-shell', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/app/explore/_components/explore-resume-tracker', () => ({ default: () => null }))

import ExploreLeaguesPage from '../../app/explore/leagues/page'

const summary = {
  leagues: [{
    key: 'missouri-summer', leagueName: 'Missouri Summer Tennis', flight: '4.0',
    ustaSection: 'Missouri Valley', districtArea: 'St. Louis', year: '2026',
    season: 'Summer', gender: 'Female', rating: '4.0', competitionLayer: 'usta',
    leagueFormat: 'team', matchCount: 12, teamCount: 4, latestMatchDate: '2026-07-05',
  }],
  totalMatches: 12, totalFlights: 1, latestMatch: '2026-07-05', notice: null,
  diagnostics: { totalParentMatches: 12, namedParentMatches: 12, missingLeagueNameCount: 0, missingTeamCount: 0, sampleMissingLeagueRows: [] },
} satisfies LeagueSummaryPayload

describe('public league initial response', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders real league cards and filter controls without waiting for browser effects', async () => {
    mocks.summary.mockResolvedValue(summary)
    const tree = await ExploreLeaguesPage()
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('Missouri Summer Tennis')
    expect(html).toContain('Missouri Valley')
    expect(html).toContain('explore-league-search')
    expect(html).toContain('href="/explore/leagues/')
    expect(html).not.toContain('USTA refreshing')
    expect(html).not.toContain('The live league layer is refreshing')
    expect(tree.props.initialSummary).not.toHaveProperty('diagnostics')
  })

  it('does not turn a data outage into a successful empty directory', async () => {
    mocks.summary.mockRejectedValue(new Error('League summary unavailable'))
    await expect(ExploreLeaguesPage()).rejects.toThrow('League summary unavailable')
  })
})
