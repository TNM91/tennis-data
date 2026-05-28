import { describe, expect, it } from 'vitest'
import { buildExploreLeagueHref } from '../competition-layers'

describe('buildExploreLeagueHref', () => {
  it('keeps registry-backed TIQ leagues on the TIQ detail route', () => {
    expect(
      buildExploreLeagueHref({
        leagueId: 'league-1',
        competitionLayer: 'tiq',
        leagueFormat: 'individual',
        leagueName: 'Summer Ladder',
      }),
    ).toBe('/explore/leagues/tiq/Summer%20Ladder?league=Summer+Ladder&league_id=league-1&format=individual')
  })

  it('routes summary-only TIQ league cards to the generic league season page', () => {
    expect(
      buildExploreLeagueHref({
        competitionLayer: 'tiq',
        leagueFormat: 'individual',
        leagueName: 'test-2-summer-2026-individual',
      }),
    ).toBe('/leagues/test-2-summer-2026-individual?league=test-2-summer-2026-individual&format=individual')
  })
})
