import { describe, expect, it } from 'vitest'
import {
  buildCaptainLineupSlots,
  getCaptainLineupFormatKey,
  getTriLevelRatings,
  isPlayerEligibleForCaptainRating,
  isTriLevelFormat,
} from '../captain-lineup-format'

describe('captain lineup formats', () => {
  it('builds the 3.5 / 4.0 / 4.5 Tri-Level flight as three doubles courts', () => {
    const league = '2026 STL Tri-Level 18 & Over'
    const flight = 'Men 3.5/4.0/4.5'

    expect(getTriLevelRatings(league, flight)).toEqual([3.5, 4, 4.5])
    expect(isTriLevelFormat(league, flight)).toBe(true)
    expect(getCaptainLineupFormatKey(league, flight)).toBe('tri-level:3.5/4/4.5')

    const slots = buildCaptainLineupSlots(league, flight, 'team')
    expect(slots).toHaveLength(3)
    expect(slots.map((slot) => slot.label)).toEqual(['3.5 Doubles', '4.0 Doubles', '4.5 Doubles'])
    expect(slots.map((slot) => slot.ratingLevel)).toEqual([3.5, 4, 4.5])
    expect(slots.every((slot) => slot.slotType === 'doubles' && slot.players.length === 2)).toBe(true)
  })

  it('supports other three-level Tri-Level flights', () => {
    const slots = buildCaptainLineupSlots(
      'USTA Tri Level',
      'Women 4.0 / 4.5 / 5.0',
      'opponent'
    )

    expect(slots.map((slot) => slot.label)).toEqual(['4.0 Doubles', '4.5 Doubles', '5.0 Doubles'])
    expect(slots.map((slot) => slot.id)).toEqual(['otl-d-4', 'otl-d-4-5', 'otl-d-5'])
  })

  it('keeps non-Tri-Level leagues on the standard format', () => {
    expect(getTriLevelRatings('2026 Adult 18 & Over', 'Men 4.0')).toEqual([])
    expect(buildCaptainLineupSlots('2026 Adult 18 & Over', 'Men 4.0', 'team')).toHaveLength(5)
  })

  it('keeps a Tri-Level court limited to players at that USTA base level', () => {
    expect(isPlayerEligibleForCaptainRating(4, 4)).toBe(true)
    expect(isPlayerEligibleForCaptainRating(4.5, 4)).toBe(false)
    expect(isPlayerEligibleForCaptainRating(null, 4)).toBe(false)
    expect(isPlayerEligibleForCaptainRating(4.23, undefined)).toBe(true)
  })
})
