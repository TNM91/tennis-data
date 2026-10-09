import { describe, expect, it } from 'vitest'
import { getVisitUpdates, readVisitTimestamp } from '@/lib/tennis-visit-updates'

describe('watchlist visit boundaries', () => {
  const now = Date.parse('2026-10-09T12:00:00Z')
  const previous = Date.parse('2026-10-08T12:00:00Z')
  it('counts only dated events after the previous visit and no later than the current visit', () => {
    const items = [
      { id: 'old', createdAt: '2026-10-08T11:00:00Z' },
      { id: 'boundary', createdAt: '2026-10-08T12:00:00Z' },
      { id: 'new', createdAt: '2026-10-09T10:00:00Z' },
      { id: 'now', createdAt: '2026-10-09T12:00:00Z' },
      { id: 'future', createdAt: '2026-10-10T12:00:00Z' },
      { id: 'rating-snapshot', createdAt: null },
      { id: 'invalid', createdAt: 'unknown' },
    ]
    expect(getVisitUpdates(items, previous, now).map(item => item.id)).toEqual(['new', 'now'])
    expect(items).toHaveLength(7)
  })
  it('does not treat the first visit or corrupt storage as unread activity', () => {
    for (const value of [null, '', ' ', 'not a date', '-1', 'Infinity', String(now + 1)]) expect(readVisitTimestamp(value, now)).toBeNull()
    expect(readVisitTimestamp(String(previous), now)).toBe(previous)
    expect(getVisitUpdates([{ createdAt: '2026-10-09' }], null, now)).toEqual([])
    expect(getVisitUpdates([{ createdAt: '2026-10-09' }], now + 1, now)).toEqual([])
  })
})
