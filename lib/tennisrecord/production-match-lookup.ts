import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductionMatch = {
  id: string; source: string | null; score: string | null; winner_side: 'A' | 'B' | null
  external_match_id?: string | null; home_team?: string | null; away_team?: string | null
  league_name?: string | null; line_number?: string | null
}
export type CanonicalParticipant = { playerId: string; side: 'A' | 'B'; seat: number }
type MatchLink = { match_id: string; player_id: string; side: 'A' | 'B'; seat: number }
export type ProductionMatchLookup = { kind: 'none' } | { kind: 'match'; match: ProductionMatch } | { kind: 'review'; candidateIds: string[] }

const sideKey = (players: CanonicalParticipant[], side: 'A' | 'B') => players.filter(p => p.side === side).map(p => p.playerId).sort().join('|')

/** Same players on the same date are not proof of the same event. */
export function classifyProductionMatchCandidates(staged: Record<string, unknown>, participants: CanonicalParticipant[], candidates: ProductionMatch[], links: MatchLink[]): ProductionMatchLookup {
  const a = sideKey(participants, 'A'); const b = sideKey(participants, 'B')
  const possible = candidates.flatMap(match => {
    const actual = links.filter(p => p.match_id === match.id).map(p => ({ playerId: p.player_id, side: p.side, seat: p.seat }))
    if (actual.length !== participants.length || new Set(actual.map(p => p.playerId)).size !== actual.length) return []
    const same = a === sideKey(actual, 'A') && b === sideKey(actual, 'B')
    const reversed = a === sideKey(actual, 'B') && b === sideKey(actual, 'A')
    return same || reversed ? [{ match, same }] : []
  })
  const knownId = typeof staged.known_canonical_match_id === 'string' ? staged.known_canonical_match_id : null
  if (!possible.length) return knownId ? { kind: 'review', candidateIds: [knownId] } : { kind: 'none' }
  // An existing source ID or established canonical association is evidence
  // of event identity. Even perfect date/team/court/score agreement alone
  // cannot distinguish a doubleheader from a duplicate across sources.
  const exact = possible.filter(p => p.same && (p.match.id === knownId || p.match.external_match_id === `tennisrecord:${staged.fingerprint}::line:${staged.court_number}`))
  if (exact.length === 1) return { kind: 'match', match: exact[0].match }
  return { kind: 'review', candidateIds: possible.map(p => p.match.id) }
}

/** Narrow by a known participant, then exhaust stable pages. Any failed read
 * aborts reconciliation: "could not check" must never mean "not a duplicate". */
export async function findExistingProductionMatch(service: SupabaseClient, staged: Record<string, unknown>, participants: CanonicalParticipant[]): Promise<ProductionMatchLookup> {
  if (!participants.length) throw new Error('Cannot check a match without participants.')
  const candidates: ProductionMatch[] = []
  const pageSize = 200
  for (let offset = 0; ; offset += pageSize) {
    const result = await service.from('match_players')
      .select('match_id,matches!inner(id,source,score,winner_side,external_match_id,home_team,away_team,league_name,line_number)')
      .eq('player_id', participants[0].playerId).eq('matches.match_date', staged.played_on)
      .eq('matches.match_type', staged.discipline).eq('matches.status', 'completed')
      .order('match_id').range(offset, offset + pageSize - 1)
    if (result.error) throw new Error(`Could not check existing matches: ${result.error.message}`)
    const rows = result.data || []
    for (const row of rows) {
      const match = row.matches as unknown as ProductionMatch | ProductionMatch[]
      candidates.push(...(Array.isArray(match) ? match : [match]))
    }
    if (rows.length < pageSize) break
  }
  const unique = [...new Map(candidates.map(m => [m.id, m])).values()]
  const links: MatchLink[] = []
  for (let offset = 0; offset < unique.length; offset += pageSize) {
    const result = await service.from('match_players').select('match_id,player_id,side,seat').in('match_id', unique.slice(offset, offset + pageSize).map(m => m.id)).limit(1000)
    if (result.error) throw new Error(`Could not check existing match players: ${result.error.message}`)
    if (result.data?.length === 1000) throw new Error('Existing court roster lookup reached its response limit; review before importing.')
    links.push(...(result.data || []) as MatchLink[])
  }
  return classifyProductionMatchCandidates(staged, participants, unique, links)
}
