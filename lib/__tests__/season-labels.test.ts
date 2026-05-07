import { describe, expect, it } from 'vitest'

import { mergeSeasonLabelOptions, normalizeSeasonLabel } from '../season-labels'

describe('normalizeSeasonLabel', () => {
  it('normalizes common season and year labels', () => {
    expect(normalizeSeasonLabel(' spring   2026 ')).toBe('Spring 2026')
    expect(normalizeSeasonLabel('2026-fall')).toBe('Fall 2026')
    expect(normalizeSeasonLabel('2026')).toBe('2026')
  })

  it('keeps custom labels while trimming whitespace', () => {
    expect(normalizeSeasonLabel('  Club Championship 2026  ')).toBe('Club Championship 2026')
  })
})

describe('mergeSeasonLabelOptions', () => {
  it('includes standard options and normalized existing labels', () => {
    expect(mergeSeasonLabelOptions([' spring   2026 ', 'Club Championship 2026'], new Date('2026-05-01'))).toEqual([
      'Winter 2026',
      'Spring 2026',
      'Summer 2026',
      'Fall 2026',
      'Club Championship 2026',
      'Winter 2027',
      'Spring 2027',
      'Summer 2027',
      'Fall 2027',
    ])
  })
})
