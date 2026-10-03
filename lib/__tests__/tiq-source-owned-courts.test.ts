import { describe, expect, it } from 'vitest'
import { isSourceOwnedCourt, loadSourceOwnedCourts } from '../tiq-source-owned-courts'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateLiveNetwork } from '../tiq-live-network'
import type { MatchRow } from '../recalculateRatings'

const match: MatchRow = { id: 'court', match_date: '2026-02-01', match_type: 'singles', score: '6-4;6-4', winner_side: 'A', match_source: 'usta', rating_eligible: true, source: 'tennisrecord', external_match_id: 'tennisrecord:event::line:1' }
const lineup = [{ match_id: 'court', player_id: 'owner', side: 'A' as const }, { match_id: 'court', player_id: 'opponent', side: 'B' as const }]
const receipt = { source: 'tennisrecord', score_text: '6-4 6-4', winner_side: 'A', participants: [{ sourcePlayerKey: 'primary', side: 'A', seat: 1 }, { sourcePlayerKey: 'other', side: 'B', seat: 1 }] }
const excluded = new Set(['owner'])
const owners = new Map([['owner', 'primary']])
describe('source-owned court identity evidence', () => {
  it('accepts exact primary ownership from the unchanged winning source receipt', () => {
    expect(isSourceOwnedCourt(match, lineup, receipt, excluded, owners)).toBe(true)
  })
  it('keeps other namesake profiles and unowned canonical players held', () => {
    expect(isSourceOwnedCourt(match, lineup, receipt, excluded, new Map([['owner', 'namesake']]))).toBe(false)
    expect(isSourceOwnedCourt(match, lineup, receipt, excluded, new Map())).toBe(false)
    expect(isSourceOwnedCourt(match, lineup, receipt, new Set(['owner', 'opponent']), owners)).toBe(false)
  })
  it('rejects a correct key placed on the wrong side', () => {
    expect(isSourceOwnedCourt(match, lineup, { ...receipt, participants: [{ sourcePlayerKey: 'primary', side: 'B', seat: 1 }, { sourcePlayerKey: 'other', side: 'A', seat: 1 }] }, excluded, owners)).toBe(false)
  })
  it('rejects edited scores, different winner evidence, and higher-authority receipts', () => {
    expect(isSourceOwnedCourt({ ...match, score: '6-0 6-0' }, lineup, receipt, excluded, owners)).toBe(false)
    expect(isSourceOwnedCourt(match, lineup, { ...receipt, winner_side: 'B' }, excluded, owners)).toBe(false)
    expect(isSourceOwnedCourt(match, lineup, { ...receipt, source: 'admin_verified' }, excluded, owners)).toBe(false)
  })
  it('rejects duplicate source identities and incomplete seats', () => {
    expect(isSourceOwnedCourt(match, lineup, { ...receipt, participants: [receipt.participants[0], { ...receipt.participants[1], sourcePlayerKey: 'primary' }] }, excluded, owners)).toBe(false)
    expect(isSourceOwnedCourt(match, lineup, { ...receipt, participants: [{ ...receipt.participants[0], seat: 0 }, receipt.participants[1]] }, excluded, owners)).toBe(false)
  })
  it('limits the exception to proven courts and retains conflict and lineup guards', () => {
    const input = { season: 2026, cutoff: '2026-10-03', matches: [match], participants: lineup, priors: new Map([['opponent', 4.5]]), excluded, conflictedMatches: new Set<string>() }
    expect(calculateLiveNetwork(input).skippedMatches[0].reason).toBe('unresolved_identity')
    const reviewed = { ...input, sourceOwnedCourts: new Set(['court']) }
    expect(calculateLiveNetwork(reviewed).snapshots).toHaveLength(4)
    expect(calculateLiveNetwork({ ...reviewed, conflictedMatches: new Set(['court']) }).skippedMatches[0].reason).toBe('source_conflict')
    expect(calculateLiveNetwork({ ...reviewed, participants: lineup.slice(0, 1) }).skippedMatches[0].reason).toBe('incomplete_lineup')
  })
})

function sourceClient(overrides: Record<string, Record<string, unknown>[]> = {}) {
  const data: Record<string, Record<string, unknown>[]> = {
    players: [{ id: 'owner', external_source: 'tennisrecord', external_source_key: 'primary' }],
    tennisrecord_player_identities: [
      { canonical_player_id: 'owner', status: 'matched', tennisrecord_staged_players: { source_player_key: 'primary' } },
      { canonical_player_id: 'owner', status: 'matched', tennisrecord_staged_players: { source_player_key: 'namesake' } },
    ],
    tennisrecord_canonical_matches: [{ canonical_match_id: 'court', winning_observation_id: 'winning', winning_source: 'tennisrecord', has_conflict: false }],
    tennisrecord_match_observations: [{ id: 'winning', ...receipt }],
    ...overrides,
  }
  return { from(table: string) {
    let rows = data[table]
    const builder = {
      select: () => builder,
      in: (column: string, values: string[]) => { rows = rows.filter(r => values.includes(String(r[column]))); return builder },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
    }
    return builder
  } } as unknown as SupabaseClient
}

describe('source court ownership loader', () => {
  it('admits the primary source court while keeping the other profile unresolved', async () => {
    expect(await loadSourceOwnedCourts(sourceClient(), [match], lineup, excluded)).toEqual(new Set(['court']))
  })
  it('withholds a court with conflicting or multiple winning aliases', async () => {
    const alias = { canonical_match_id: 'court', winning_observation_id: 'winning', winning_source: 'tennisrecord', has_conflict: false }
    expect(await loadSourceOwnedCourts(sourceClient({ tennisrecord_canonical_matches: [alias, { ...alias, winning_observation_id: 'second' }] }), [match], lineup, excluded)).toEqual(new Set())
    expect(await loadSourceOwnedCourts(sourceClient({ tennisrecord_canonical_matches: [{ ...alias, has_conflict: true }] }), [match], lineup, excluded)).toEqual(new Set())
  })
  it('withholds an ambiguous primary profile even with a matching receipt', async () => {
    expect(await loadSourceOwnedCourts(sourceClient({ tennisrecord_player_identities: [{ canonical_player_id: 'owner', status: 'ambiguous', tennisrecord_staged_players: { source_player_key: 'primary' } }] }), [match], lineup, excluded)).toEqual(new Set())
  })
  it('does not authorize from a potentially truncated identity query', async () => {
    const links = Array.from({ length: 1000 }, (_, i) => ({ canonical_player_id: 'owner', status: 'matched', tennisrecord_staged_players: { source_player_key: i === 0 ? 'primary' : `other-${i}` } }))
    expect(await loadSourceOwnedCourts(sourceClient({ tennisrecord_player_identities: links }), [match], lineup, excluded)).toEqual(new Set())
  })
})
