import { describe, expect, it } from 'vitest'
import { getCurrentRatingHistory, getPlayerRatingStatus } from '../player-rating-context'

describe('player rating context', () => {
  it('withholds a published-level comparison when the baseline is unverified or invalid', () => {
    expect(getPlayerRatingStatus(7, 4.6, false)).toBe('USTA comparison pending')
    expect(getPlayerRatingStatus(4.5, 4.6, true)).toBe('Within band')
    expect(getPlayerRatingStatus(NaN, 4.6, true)).toBe('USTA comparison pending')
  })

  it('counts unique rated matches in the selected format and season, treating legacy rows as overall', () => {
    const rows = [
      { match_id: 'old', snapshot_date: '2025-12-20', rating_type: 'singles' },
      { match_id: 'a', snapshot_date: '2026-02-01', rating_type: 'singles' },
      { match_id: 'a', snapshot_date: '2026-02-02', rating_type: 'singles' },
      { match_id: 'b', snapshot_date: '2026-03-01', rating_type: 'doubles' },
      { match_id: 'a', snapshot_date: '2026-02-01', rating_type: 'overall' },
      { match_id: 'legacy', snapshot_date: '2026-01-01', rating_type: null },
      { match_id: null, snapshot_date: '2026-04-01', rating_type: 'overall' },
    ]
    expect(getCurrentRatingHistory(rows, 'singles', 2026).map(r => r.snapshot_date)).toEqual(['2026-02-02'])
    expect(getCurrentRatingHistory(rows, 'doubles', 2026).map(r => r.match_id)).toEqual(['b'])
    expect(getCurrentRatingHistory(rows, 'overall', 2026).map(r => r.match_id)).toEqual(['legacy', 'a'])
  })
})
