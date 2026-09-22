import { describe, expect, it } from 'vitest'
import { dedupeLeagueResultFeed, formatUpcomingWatchlistDate, hasWatchlistResult, isUpcomingWatchlistMatch, sortUpcomingWatchlistFeed, sortWatchlistFeed } from '@/lib/watchlist-feed'

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

  it('keeps unscored future matches separate from results and orders the next match first', () => {
    const now = new Date(2026, 8, 21, 15)
    expect(isUpcomingWatchlistMatch('2026-09-27', null, now)).toBe(true)
    expect(isUpcomingWatchlistMatch('2026-09-21', 'Pending', now)).toBe(true)
    expect(isUpcomingWatchlistMatch('2026-09-20', null, now)).toBe(false)
    expect(isUpcomingWatchlistMatch('2026-09-27', '6-4 6-2', now)).toBe(false)
    expect(hasWatchlistResult('6-4 6-2')).toBe(true)
    expect(hasWatchlistResult('Pending')).toBe(false)
    expect(hasWatchlistResult(null)).toBe(false)
    expect(formatUpcomingWatchlistDate('2026-09-21')).toBe(new Date(2026, 8, 21, 12).toLocaleDateString())
    expect(sortUpcomingWatchlistFeed([
      { createdAt: '2026-10-06', score: 94 },
      { createdAt: '2026-09-27', score: 94 },
    ]).map((item) => item.createdAt)).toEqual(['2026-09-27', '2026-10-06'])
  })

  it('shows one card for repeated league results while preserving distinct match days and other updates', () => {
    const row = { event_type: 'league_result_posted', entity_type: 'league', entity_id: 'league-1', title: 'New result posted', body: 'Aces vs Volleys • 3-2 lines on 2026-09-20', created_at: '2026-09-21T10:00:00Z' }
    const repeated = { ...row, created_at: '2026-09-20T10:00:00Z' }
    const anotherDay = { ...row, body: 'Aces vs Volleys • 3-2 lines on 2026-09-27' }
    const anotherLeague = { ...row, entity_id: 'league-2' }
    const otherUpdate = { ...row, event_type: 'match_result' }
    expect(dedupeLeagueResultFeed([row, repeated, anotherDay, anotherLeague, otherUpdate])).toEqual([row, anotherDay, anotherLeague, otherUpdate])
  })
})
