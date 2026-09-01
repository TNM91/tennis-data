import { describe, expect, it } from 'vitest'
import { filterMatchbookEntries, getMatchbookFilterLabel } from '@/lib/player-matchbook'

describe('player matchbook', () => {
  const entries = [
    { id: 's-1', matchType: 'Singles' },
    { id: 'd-1', matchType: 'Doubles' },
    { id: 'open-1', matchType: null },
  ]

  it('keeps the chronological source order while filtering by court', () => {
    expect(filterMatchbookEntries(entries, 'all').map((entry) => entry.id)).toEqual(['s-1', 'd-1', 'open-1'])
    expect(filterMatchbookEntries(entries, 'singles').map((entry) => entry.id)).toEqual(['s-1'])
    expect(filterMatchbookEntries(entries, 'doubles').map((entry) => entry.id)).toEqual(['d-1'])
  })

  it('uses plain, player-facing filter labels', () => {
    expect(getMatchbookFilterLabel('all')).toBe('All matches')
    expect(getMatchbookFilterLabel('singles')).toBe('Singles')
    expect(getMatchbookFilterLabel('doubles')).toBe('Doubles')
  })
})
