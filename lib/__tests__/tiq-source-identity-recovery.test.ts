import { describe, expect, it } from 'vitest'
import { recoverSourceIdentityCourt, type RecoveryCourt, type SourceCourtEvidence } from '../tiq-source-identity-recovery'
const a = `trp_${'a'.repeat(64)}`, b = `trp_${'b'.repeat(64)}`, c = `trp_${'c'.repeat(64)}`
const court: RecoveryCourt = { date: '2026-02-01', format: 'singles', score: '6-3; 6-2', winnerSide: 'A', participants: [{ playerId: 'shared', side: 'A' }, { playerId: 'opponent', side: 'B' }] }
const evidence: SourceCourtEvidence = { played_on: court.date, discipline: 'singles', score_text: '6-3 6-2', winner_side: 'A', participants: [{ sourcePlayerKey: a, side: 'A', seat: 1 }, { sourcePlayerKey: b, side: 'B', seat: 1 }] }
const links = new Map([[a, { canonicalPlayerId: 'shared', status: 'ambiguous' }], [b, { canonicalPlayerId: 'opponent', status: 'matched' }], [c, { canonicalPlayerId: 'shared', status: 'matched' }]])
const recover = (rows = [evidence]) => recoverSourceIdentityCourt({ court, evidence: rows, links, ambiguousCanonicalIds: new Set(['shared']) })
describe('research source identity recovery', () => {
  it('separates an ambiguous source profile while preserving a matched opponent', () => {
    const result = recover()
    expect(result.admitted).toBe(true)
    expect(result.participants).toEqual([{ playerId: `tr-source:${a}`, side: 'A' }, { playerId: 'opponent', side: 'B' }])
    expect(court.participants[0].playerId).toBe('shared')
  })
  it('does not choose between same-name source variants', () => {
    const variant = { ...evidence, participants: [{ sourcePlayerKey: c, side: 'A', seat: 1 }, evidence.participants[1]] }
    expect(recover([evidence, variant]).reason).toBe('conflicting_source_identity_variants')
  })
  it.each(['played_on', 'discipline', 'score_text', 'winner_side'] as const)('rejects conflicting %s', field => {
    expect(recover([{ ...evidence, [field]: 'conflicting' }]).reason).toBe('source_court_conflict')
  })
  it('rejects a source lineup with swapped canonical sides', () => {
    const swapped = { ...evidence, participants: evidence.participants.map(p => ({ ...p, side: p.side === 'A' ? 'B' : 'A' })) }
    expect(recover([swapped]).reason).toBe('original_side_membership_mismatch')
  })
  it('rejects a rejected source link even when its canonical ID is retained', () => {
    const rejected = new Map(links); rejected.set(a, { canonicalPlayerId: 'shared', status: 'rejected' })
    expect(recoverSourceIdentityCourt({ court, evidence: [evidence], links: rejected, ambiguousCanonicalIds: new Set(['shared']) }).reason).toBe('missing_identity_lineage')
  })
  it('requires one unique seat per side in doubles', () => {
    const d = `trp_${'d'.repeat(64)}`
    const doubles: RecoveryCourt = { ...court, format: 'doubles', participants: [...court.participants, { playerId: 'partner', side: 'A' }, { playerId: 'other', side: 'B' }] }
    const duplicateSeat = { ...evidence, discipline: 'doubles', participants: [...evidence.participants, { sourcePlayerKey: c, side: 'A', seat: 1 }, { sourcePlayerKey: d, side: 'B', seat: 2 }] }
    expect(recoverSourceIdentityCourt({ court: doubles, evidence: [duplicateSeat], links, ambiguousCanonicalIds: new Set(['shared']) }).reason).toBe('invalid_source_lineup')
  })
  it('accepts equivalent repeated source observations', () => {
    expect(recover([evidence, { ...evidence, participants: [...evidence.participants].reverse() }]).admitted).toBe(true)
  })
  it('recovers equivalent B-winning scores without changing the frozen interpretation', () => {
    const normalized: RecoveryCourt = { ...court, score: '3-6; 2-6', winnerSide: 'B' }
    const winnerFirst = { ...evidence, winner_side: 'B' }
    const result = recoverSourceIdentityCourt({ court: normalized, evidence: [winnerFirst], links, ambiguousCanonicalIds: new Set(['shared']) })
    expect(result.admitted).toBe(true)
    expect(normalized.score).toBe('3-6; 2-6')
  })
  it('does not treat a partial score reversal as equivalent', () => {
    const normalized: RecoveryCourt = { ...court, score: '3-6 2-6', winnerSide: 'B' }
    expect(recoverSourceIdentityCourt({ court: normalized, evidence: [{ ...evidence, winner_side: 'B', score_text: '6-3 2-6' }], links, ambiguousCanonicalIds: new Set(['shared']) }).reason).toBe('source_court_conflict')
  })
  it('does not assume winner-first reversal for an A-winning result', () => {
    expect(recover([{ ...evidence, score_text: '3-6 2-6' }]).reason).toBe('source_court_conflict')
  })
  it('rejects missing evidence', () => { expect(recover([]).reason).toBe('missing_source_court') })
})

