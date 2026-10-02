import { describe, expect, it } from 'vitest'
import { replayRatingNetwork, type NetworkCourt } from '../tiq-rating-network'
const court = (id: string, date: string, a: string, b: string, actualGameShare = 0.7): NetworkCourt => ({ id, date, format: 'singles', participants: [{ playerId: a, side: 'A' }, { playerId: b, side: 'B' }], actualGameShare })
const replay = (courts: NetworkCourt[], cutoff = '2026-10-02') => replayRatingNetwork({ startsOn: '2026-01-01', cutoff, priors: new Map([['a', 4.5]]), courts })
describe('experimental chronological rating network', () => {
  it('future outcomes cannot affect earlier predictions or states', () => {
    const earlier = court('1', '2026-02-01', 'a', 'b')
    const first = replay([earlier], '2026-02-01'), second = replay([earlier, court('2', '2026-03-01', 'a', 'b', 0)], '2026-02-01')
    expect(second).toEqual(first)
  })
  it('uses identical pre-day states for repeated same-day matches', () => {
    const result = replay([court('1', '2026-02-01', 'a', 'b', 1), court('2', '2026-02-01', 'a', 'b', 0)])
    expect(result.predictions.map(p => p.expectedGameShare)).toEqual([0.5, 0.5])
    expect(result.states.get('a:singles')?.strength).toBe(4.75)
  })
  it('does not propagate newly inferred players through same-day lineups', () => {
    const result = replay([court('1', '2026-02-01', 'a', 'b'), court('2', '2026-02-01', 'b', 'c'), court('3', '2026-02-02', 'b', 'c')])
    expect(result.skippedUnanchored).toEqual(['2'])
    expect(result.states.get('c:singles')?.anchorDistance).toBe(2)
    expect(result.states.get('c:singles')?.startingEvidence).toBe('network-estimate')
  })
  it('leaves disconnected components unrated', () => {
    const result = replay([court('1', '2026-02-01', 'b', 'c')])
    expect(result.states.size).toBe(0)
    expect(result.skippedUnanchored).toEqual(['1'])
  })
  it('keeps formats separate and never asserts official forecasts', () => {
    const result = replay([court('1', '2026-02-01', 'a', 'b')])
    expect(result.states.has('a:doubles')).toBe(false)
    expect(result.confidenceCalibrated).toBe(false)
    expect(result.movementForecastAvailable).toBe(false)
  })
  it('rejects duplicate courts, incomplete identities and impossible dates', () => {
    const sample = court('1', '2026-02-01', 'a', 'b')
    expect(() => replay([sample, sample])).toThrow()
    expect(() => replay([court('1', '2026-02-01', 'a', 'a')])).toThrow()
    expect(() => replay([court('1', '2026-02-30', 'a', 'b')])).toThrow()
  })
})

describe('starting rating and partner sensitivity', () => {
  it('a shared scale shift changes displayed strength without changing relative predictions', () => {
    const courts = [court('1', '2026-02-01', 'a', 'b'), court('2', '2026-02-02', 'a', 'b')]
    const base = replay(courts), shifted = replayRatingNetwork({ startsOn: '2026-01-01', cutoff: '2026-10-02', courts, priors: new Map([['a', 4.5]]), config: { priorOffset: 0.5 } })
    expect(shifted.predictions.map(p => p.expectedGameShare)).toEqual(base.predictions.map(p => p.expectedGameShare))
    expect(shifted.states.get('a:singles')!.strength - base.states.get('a:singles')!.strength).toBeCloseTo(0.25)
  })
  it('discounts repeated partners using only preceding-day partnership evidence', () => {
    const doubles = (id: string, date: string): NetworkCourt => ({ id, date, format: 'doubles', participants: [{ playerId: 'a', side: 'A' }, { playerId: 'b', side: 'A' }, { playerId: 'c', side: 'B' }, { playerId: 'd', side: 'B' }], actualGameShare: 0.7 })
    const courts = [doubles('1', '2026-02-01'), doubles('2', '2026-02-02')], priors = new Map(['a', 'b', 'c', 'd'].map(id => [id, 4.5])), input = { startsOn: '2026-01-01', cutoff: '2026-10-02', courts, priors }
    const base = replayRatingNetwork(input), discounted = replayRatingNetwork({ ...input, config: { repeatedPartnerWeight: 0.5 } })
    expect(discounted.predictions).toEqual(base.predictions)
    expect(discounted.states.get('a:doubles')!.strength).toBeLessThan(base.states.get('a:doubles')!.strength)
    expect(discounted.states.get('a:doubles')!.partners.size).toBe(1)
  })
  it('rejects invalid sensitivity and update parameters', () => {
    const input = { startsOn: '2026-01-01', cutoff: '2026-10-02', courts: [], priors: new Map<string, number>() }
    expect(() => replayRatingNetwork({ ...input, config: { unknownVariance: -1 } })).toThrow()
    expect(() => replayRatingNetwork({ ...input, priorStrengthShifts: new Map([['a', NaN]]) })).toThrow()
  })
})
