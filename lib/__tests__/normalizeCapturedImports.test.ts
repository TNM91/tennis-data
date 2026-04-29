import { describe, expect, it } from 'vitest'
import { normalizeCapturedScorecardPayload } from '../ingestion/normalizeCapturedImports'

describe('normalizeCapturedScorecardPayload', () => {
  it('splits concatenated doubles player names and ignores line labels as league names', () => {
    const result = normalizeCapturedScorecardPayload({
      pageType: 'scorecard',
      scorecard: {
        externalMatchId: 'M-1',
        dateMatchPlayed: '04/28/2026',
        homeTeam: 'Home Club',
        awayTeam: 'Away Club',
        leagueName: '1 # Singles',
        flight: '3.5',
        lines: [
          {
            lineNumber: 1,
            matchType: 'doubles',
            homePlayers: ['Matthew Hodge Alex Schaefer'],
            awayPlayers: ['CHRISTOPHER KRIEGER David Cabrera'],
            winnerSide: 'home',
            score: '6-4, 6-4',
          },
        ],
      },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].leagueName).toBeNull()
    expect(result.rows[0].lines[0].sideAPlayers).toEqual(['Matthew Hodge', 'Alex Schaefer'])
    expect(result.rows[0].lines[0].sideBPlayers).toEqual(['CHRISTOPHER KRIEGER', 'David Cabrera'])
  })
})
