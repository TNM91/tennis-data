import { equivalentScoreOrientation } from './tennisrecord/result-integrity'

export type RecoveryParticipant = { playerId: string; side: 'A' | 'B' }
export type RecoveryCourt = { date: string; format: 'singles' | 'doubles'; score: string; winnerSide: 'A' | 'B'; participants: RecoveryParticipant[] }
export type SourceCourtEvidence = { played_on: string | null; discipline: string; score_text: string | null; winner_side: string | null; participants: { sourcePlayerKey: string; side: string; seat: number }[] }
export type SourceIdentityLink = { canonicalPlayerId: string | null; status: string }
const scoreIdentity = (score: string) => score.replace(/;/g, ' ').replace(/\s+/g, ' ').trim()
const sideIdentity = (participants: RecoveryParticipant[], side: string) => participants.filter(p => p.side === side).map(p => p.playerId).sort().join(',')
/** Research-only separation of source identities. Does not establish that aliases are different people. */
export function recoverSourceIdentityCourt(input: {
  court: RecoveryCourt
  evidence: SourceCourtEvidence[]
  links: ReadonlyMap<string, SourceIdentityLink>
  ambiguousCanonicalIds: ReadonlySet<string>
}) {
  const reject = (reason: string) => ({ admitted: false as const, reason, participants: [] as RecoveryParticipant[] })
  const { court } = input, perSide = court.format === 'singles' ? 1 : 2
  if (!['singles', 'doubles'].includes(court.format) || !['A', 'B'].includes(court.winnerSide) || !court.score || court.participants.length !== perSide * 2 || new Set(court.participants.map(p => p.playerId)).size !== perSide * 2 || court.participants.some(p => !p.playerId || !['A', 'B'].includes(p.side)) || ['A', 'B'].some(side => court.participants.filter(p => p.side === side).length !== perSide)) return reject('invalid_original_lineup')
  if (!input.evidence.length) return reject('missing_source_court')
  const variants = new Map<string, RecoveryParticipant[]>()
  for (const evidence of input.evidence) {
    if (evidence.played_on !== court.date || evidence.discipline !== court.format || evidence.winner_side !== court.winnerSide || !evidence.score_text || !(scoreIdentity(evidence.score_text) === scoreIdentity(court.score) || (court.winnerSide === 'B' && equivalentScoreOrientation(scoreIdentity(court.score), scoreIdentity(evidence.score_text))))) return reject('source_court_conflict')
    // Preserve the frozen score interpretation. Full reversal can express the same
    // B-winning sets in the source's winner-first display; partial reversals conflict.
    const source = evidence.participants
    if (source.length !== perSide * 2 || source.some(p => !/^trp_[a-f0-9]{64}$/.test(p.sourcePlayerKey) || !['A', 'B'].includes(p.side) || !Number.isInteger(p.seat) || p.seat < 1 || p.seat > perSide) || new Set(source.map(p => p.sourcePlayerKey)).size !== perSide * 2 || ['A', 'B'].some(side => source.filter(p => p.side === side).length !== perSide || new Set(source.filter(p => p.side === side).map(p => p.seat)).size !== perSide)) return reject('invalid_source_lineup')
    const mapped: RecoveryParticipant[] = [], recovered: RecoveryParticipant[] = []
    for (const participant of source) {
      const link = input.links.get(participant.sourcePlayerKey)
      if (!link?.canonicalPlayerId || !['matched', 'ambiguous'].includes(link.status)) return reject('missing_identity_lineage')
      const ambiguous = input.ambiguousCanonicalIds.has(link.canonicalPlayerId)
      if (!ambiguous && link.status !== 'matched') return reject('unreviewed_unambiguous_link')
      const side = participant.side as 'A' | 'B'
      mapped.push({ playerId: link.canonicalPlayerId, side })
      recovered.push({ playerId: ambiguous ? `tr-source:${participant.sourcePlayerKey}` : link.canonicalPlayerId, side })
    }
    if (['A', 'B'].some(side => sideIdentity(mapped, side) !== sideIdentity(court.participants, side))) return reject('original_side_membership_mismatch')
    const signature = ['A', 'B'].map(side => sideIdentity(recovered, side)).join('|')
    variants.set(signature, recovered)
  }
  if (variants.size !== 1) return reject('conflicting_source_identity_variants')
  return { admitted: true as const, reason: null, participants: [...variants.values()][0] }
}

