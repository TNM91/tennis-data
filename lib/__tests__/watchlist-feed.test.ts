import { describe, expect, it } from 'vitest'
import { sortWatchlistFeed } from '@/lib/watchlist-feed'

describe('watchlist feed ordering', () => {
  it('shows dated results before standing snapshots, regardless of editorial score', () => {
    const items = [
      { id: 'rating', createdAt: null, score: 999 },
      { id: 'older-result', createdAt: '2026-08-10', score: 120 },
      { id: 'newer-result', createdAt: '2026-09-20', score: 80 },
      { id: 'league-entry', createdAt: '', score: 90 },
    ]

    expect(sortWatchlistFeed(items).map((item) => item.id)).toEqual([
      'newer-result', 'older-result', 'rating', 'league-entry',
    ])
    expect(items[0].id).toBe('rating')
  })

  it('uses relevance only to break ties within the same event date or snapshot group', () => {
    const items = [
      { id: 'less-relevant', createdAt: '2026-09-20', score: 10 },
      { id: 'more-relevant', createdAt: '2026-09-20', score: 90 },
      { id: 'invalid-date', createdAt: 'unknown', score: 100 },
    ]

    expect(sortWatchlistFeed(items).map((item) => item.id)).toEqual([
      'more-relevant', 'less-relevant', 'invalid-date',
    ])
  })
})
