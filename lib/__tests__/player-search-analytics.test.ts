import { describe, expect, it } from 'vitest'
import { getPlayerSearchContextCoverage, getPlayerSearchCountBand } from '../player-search-analytics'

describe('player search analytics categories', () => {
  it('classifies the visible result cards by available match context', () => {
    expect(getPlayerSearchContextCoverage([])).toBe('none')
    expect(getPlayerSearchContextCoverage([{ recent_match_team: 'Aces' }, { recent_match_team: '  ' }])).toBe('some')
    expect(getPlayerSearchContextCoverage([{ recent_match_team: 'Aces' }, { recent_match_team: 'Rallies' }])).toBe('all')
  })

  it('uses the same position bands for result counts and opened cards', () => {
    expect([1, 8, 9, 16, 17, 24].map(getPlayerSearchCountBand)).toEqual([
      '1-8', '1-8', '9-16', '9-16', '17-24', '17-24',
    ])
  })
})
