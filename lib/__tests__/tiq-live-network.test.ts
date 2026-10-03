import { describe, expect, it } from 'vitest'
import { calculateLiveNetwork } from '../tiq-live-network'
import type { MatchRow } from '../recalculateRatings'
const match = (id: string, date = '2026-02-01', score = '6-4 6-4'): MatchRow => ({ id, match_date: date, match_type: 'singles', score, winner_side: 'A', match_source: 'usta', rating_eligible: true, league_name: '2026 Adult 18+ 3.5' })
const participants = (match_id: string, a = 'a', b = 'b') => [{ match_id, player_id: a, side: 'A' as const }, { match_id, player_id: b, side: 'B' as const }]
const input = { season: 2026, cutoff: '2026-10-02', priors: new Map([['a', 4.5]]), excluded: new Set<string>(), conflictedMatches: new Set<string>() }
describe('live network adapter', () => {
  it('publishes daily end states consistently in format and overall history', () => {
    const result = calculateLiveNetwork({ ...input, matches: [match('1')], participants: participants('1') })
    expect(result.snapshots).toHaveLength(4)
    const a = result.snapshots.filter(s => s.player_id === 'a')
    expect(a.map(s => s.dynamic_rating)).toEqual([result.states.get('a:singles')!.strength, result.states.get('a:singles')!.strength])
    expect(a[0].delta).toBeCloseTo(a[0].dynamic_rating - 4.75)
    expect(a[0].win_probability).toBeNull()
    expect(result.states.get('b:singles')!.startingEvidence).toBe('network-estimate')
  })
  it('uses the same day-end rating on repeated same-day courts', () => {
    const result = calculateLiveNetwork({ ...input, matches: [match('1'), match('2')], participants: [...participants('1'), ...participants('2')] })
    const strengths = result.snapshots.filter(s => s.player_id === 'a' && s.rating_type === 'singles').map(s => s.dynamic_rating)
    expect(strengths[0]).toBe(strengths[1])
    expect(result.predictions[0].expectedGameShare).toBe(result.predictions[1].expectedGameShare)
  })
  it('rejects identity and result conflicts without creating snapshots', () => {
    const result = calculateLiveNetwork({ ...input, matches: [match('1'), match('2')], participants: [...participants('1'), ...participants('2', 'a', 'c')], excluded: new Set(['b']), conflictedMatches: new Set(['2']) })
    expect(result.snapshots).toEqual([])
    expect(result.skippedMatches.map(m => m.reason)).toEqual(['unresolved_identity', 'source_conflict'])
  })
  it('does not admit future courts, incomplete scores or unsupported sources', () => {
    const result = calculateLiveNetwork({ ...input, matches: [match('1', '2026-12-01'), match('2', '2026-02-01', 'default'), { ...match('3'), match_source: null }], participants: [...participants('1'), ...participants('2'), ...participants('3')] })
    expect(result.snapshots).toEqual([])
    expect(result.skippedMatches).toHaveLength(2)
  })
  it('does not fabricate an estimate for an unanchored division', () => {
    const result = calculateLiveNetwork({ ...input, priors: new Map(), matches: [match('1')], participants: participants('1') })
    expect(result.snapshots).toEqual([])
    expect(result.skippedMatches[0].reason).toBe('unanchored_network')
  })
})
