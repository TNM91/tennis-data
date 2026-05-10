import { describe, expect, it } from 'vitest'
import { getMatchupStaleSelectionNotice, normalizeMatchupPlayerOptions } from '../matchup-player-options'

describe('normalizeMatchupPlayerOptions', () => {
  it('drops deleted or malformed player rows before Matchup selectors render', () => {
    const options = normalizeMatchupPlayerOptions([
      { id: 'p1', name: '  Alex Rally  ', overall_dynamic_rating: 3.42 },
      { id: '', name: 'No id' },
      { id: 'p2', name: '   ' },
      { id: null, name: 'Missing id' },
      { id: 'p3', name: 'Deleted Player', is_deleted: true },
      { id: 'p4', name: 'Archived Player', archived_at: '2026-05-01T12:00:00Z' },
      { id: 'p5', name: 'Removed Player', status: 'removed' },
      { id: 'p6', name: 'Inactive Player', is_active: false },
    ])

    expect(options).toEqual([
      { id: 'p1', name: 'Alex Rally', overall_dynamic_rating: 3.42 },
    ])
  })

  it('keeps the first active row when stale duplicate ids appear', () => {
    const options = normalizeMatchupPlayerOptions([
      { id: 'p1', name: 'First Name' },
      { id: 'p1', name: 'Duplicate Name' },
      { id: ' p2 ', name: ' Second Name ' },
    ])

    expect(options.map((option) => option.name)).toEqual(['First Name', 'Second Name'])
    expect(options.map((option) => option.id)).toEqual(['p1', 'p2'])
  })

  it('keeps stale-selection copy tied to reviewed Data Assist refreshes', () => {
    expect(getMatchupStaleSelectionNotice(1)).toContain('Data Assist after review')
    expect(getMatchupStaleSelectionNotice(2)).toContain('those records need to be refreshed')
  })
})
