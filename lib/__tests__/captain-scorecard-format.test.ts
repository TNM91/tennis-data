import { describe, expect, it } from 'vitest'
import {
  captainScorecardOpponentSlots,
  inferCaptainScorecardFormat,
} from '@/lib/captain-scorecard-format'

describe('Captain scorecard formats', () => {
  it('uses one clean opponent name space for singles and two for doubles', () => {
    expect(captainScorecardOpponentSlots('Singles 1')).toBe(1)
    expect(captainScorecardOpponentSlots('Singles 2')).toBe(1)
    expect(captainScorecardOpponentSlots('Doubles 1')).toBe(2)
    expect(captainScorecardOpponentSlots('4.5 Doubles')).toBe(2)
  })

  it('recognizes regular, mixed, and both common Tri-Level bands from the actual courts', () => {
    expect(inferCaptainScorecardFormat({
      leagueName: 'Adult 18 & Over',
      lineup: [
        { label: 'Singles 1' },
        { label: 'Singles 2' },
        { label: 'Doubles 1' },
        { label: 'Doubles 2' },
        { label: 'Doubles 3' },
      ],
    }).label).toBe('Regular team')

    expect(inferCaptainScorecardFormat({
      leagueName: 'Mixed 18 & Over',
      lineup: [{ label: 'Doubles 1' }, { label: 'Doubles 2' }, { label: 'Doubles 3' }],
    }).label).toBe('Mixed doubles')

    for (const levels of [['3.5', '4.0', '4.5'], ['4.0', '4.5', '5.0']]) {
      const format = inferCaptainScorecardFormat({
        leagueName: 'Tri-Level',
        lineup: levels.map((level) => ({ label: `${level} Doubles` })),
      })
      expect(format.label).toBe('Tri-Level')
      expect(format.doublesCount).toBe(3)
    }

    expect(inferCaptainScorecardFormat({
      leagueName: 'Fall Tri Level',
      lineup: [{ label: 'Doubles 1' }, { label: 'Doubles 2' }, { label: 'Doubles 3' }],
    }).label).toBe('Tri-Level')
  })
})
