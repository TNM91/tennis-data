import { describe, expect, it } from 'vitest'
import { normalizeMatchupPlayerOptions } from '../matchup-player-options'

describe('normalizeMatchupPlayerOptions', () => {
  it('drops deleted or malformed player rows before Matchup selectors render', () => {
    const options = normalizeMatchupPlayerOptions([
      { id: 'p1', name: '  Alex Rally  ', overall_dynamic_rating: 3.42 },
      { id: '', name: 'No id' },
      { id: 'p2', name: '   ' },
      { id: null, name: 'Missing id' },
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
})
