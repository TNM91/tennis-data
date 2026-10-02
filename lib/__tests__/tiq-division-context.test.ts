import { describe, expect, it } from 'vitest'
import { individualAdultDivisionLevel } from '../tiq-division-context'
import { replayRatingNetwork, type NetworkCourt } from '../tiq-rating-network'
const court = (id: string, a: string, b: string, divisionLevel = 3.5): NetworkCourt => ({ id, date: '2026-02-01', format: 'singles', participants: [{ playerId: a, side: 'A' }, { playerId: b, side: 'B' }], actualGameShare: 0.5, divisionLevel })
const input = { startsOn: '2026-01-01', cutoff: '2026-10-02', priors: new Map([['a', 4.5]]) }
describe('research individual division context', () => {
  it('preserves the reference when disabled', () => {
    const withContext = court('1', 'a', 'b')
    const withoutContext = { ...withContext }
    delete withoutContext.divisionLevel
    expect(replayRatingNetwork({ ...input, courts: [withContext] })).toEqual(replayRatingNetwork({ ...input, courts: [withoutContext] }))
  })
  it('blends only unknown initial strength and preserves evidence ancestry', () => {
    const result = replayRatingNetwork({ ...input, courts: [court('1', 'a', 'b')], config: { response: 0, divisionContextWeight: 0.75 } })
    expect(result.states.get('a:singles')?.strength).toBe(4.75)
    expect(result.states.get('b:singles')).toMatchObject({ strength: 4, startingEvidence: 'network-estimate', anchorDistance: 1 })
    expect(result.movementForecastAvailable).toBe(false)
  })
  it('does not create anchors or propagate new states on the same day', () => {
    const result = replayRatingNetwork({ ...input, courts: [court('1', 'a', 'b'), court('2', 'b', 'c'), court('3', 'x', 'y')], config: { divisionContextWeight: 1 } })
    expect(result.skippedUnanchored).toEqual(['2', '3'])
    expect(result.states.has('c:singles')).toBe(false)
  })
  it.each([6, 7, NaN, 3.25, 1])('rejects invalid individual context %s', divisionLevel => {
    expect(() => replayRatingNetwork({ ...input, courts: [court('1', 'a', 'b', divisionLevel)] })).toThrow('Invalid individual division context')
  })
  it.each([-0.1, 1.1, NaN])('rejects invalid blend weight %s', divisionContextWeight => {
    expect(() => replayRatingNetwork({ ...input, courts: [], config: { divisionContextWeight } })).toThrow('Invalid network configuration')
  })
  it.each(['2026 Adult 18+ 3.5', '2026 Adult 55+ 3.5'])('accepts straight individual divisions %s', name => {
    expect(individualAdultDivisionLevel(name, 2026)).toBe(3.5)
  })
  it.each(['2025 Adult 3.5', '2026 Mixed Adult 3.5', '2026 Adult Combo 3.5', '2026 Adult Tri-Level 3.5', '2026 Adult 55+ 7.0', '2026 Adult 8.0', '2026 Adult 9.0', '2026 Adult 3.5 / 8.0', '2026 Adult 3.5 / 4.0', '2026 Tournament 3.5'])('rejects inapplicable or combined context %s', name => {
    expect(individualAdultDivisionLevel(name, 2026)).toBeNull()
  })
})

