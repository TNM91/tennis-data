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
import type { SupabaseClient } from '@supabase/supabase-js'
import { orientReviewedLiveScores } from '../tiq-live-network'
function provenanceClient(observations: Record<string, unknown>[], aliases = [{ canonical_match_id: '1', winning_observation_id: 'o' }]) {
  return { from(table: string) {
    let rows: Record<string, unknown>[] = table === 'tennisrecord_canonical_matches' ? aliases : observations
    const builder = {
      select: () => builder,
      in: (column: string, values: string[]) => { rows = rows.filter(row => values.includes(String(row[column]))); return builder },
      eq: () => builder,
      then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
    }
    return builder
  } } as unknown as SupabaseClient
}
describe('reviewed source score orientation', () => {
  const source = { ...match('1', '2026-02-01', '6-3 6-3'), winner_side: 'B' as const, source: 'tennisrecord', external_match_id: 'tennisrecord:source-court' }
  const observation = { id: 'o', source: 'tennisrecord', winner_side: 'B', score_text: '6-3 6-3' }
  it('orients only an exact winning source receipt and preserves the original input', async () => {
    const rows = await orientReviewedLiveScores(provenanceClient([observation]), [source])
    expect(rows[0].score).toBe('3-6 3-6')
    expect(rows[0].winner_side).toBe('B')
    expect(source.score).toBe('6-3 6-3')
  })
  it.each([{ ...observation, source: 'captain' }, { ...observation, winner_side: 'A' }, { ...observation, score_text: '6-2 6-2' }])('does not guess orientation from conflicting evidence', async evidence => {
    expect((await orientReviewedLiveScores(provenanceClient([evidence]), [source]))[0].score).toBe(source.score)
  })
  it('rejects missing and contradictory winning variants', async () => {
    const aliases = [{ canonical_match_id: '1', winning_observation_id: 'o' }, { canonical_match_id: '1', winning_observation_id: 'missing' }]
    expect((await orientReviewedLiveScores(provenanceClient([observation], aliases), [source]))[0].score).toBe(source.score)
  })
  it('orients a split-set deciding tiebreak only with the exact winning receipt', async () => {
    const court = { ...source, score: '4-6 6-2 1-0' }
    const evidence = { ...observation, score_text: court.score }
    expect((await orientReviewedLiveScores(provenanceClient([evidence]), [court]))[0].score).toBe('6-4 2-6 0-1')
    expect((await orientReviewedLiveScores(provenanceClient([{ ...evidence, score_text: '4-6 6-3 1-0' }]), [court]))[0].score).toBe(court.score)
    const alreadyOriented = { ...court, score: '6-4 2-6 0-1' }
    expect((await orientReviewedLiveScores(provenanceClient([evidence]), [alreadyOriented]))[0].score).toBe(alreadyOriented.score)
  })
})
