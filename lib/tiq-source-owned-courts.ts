import type { SupabaseClient } from '@supabase/supabase-js'
import { parseScoreMetrics, type MatchRow } from './recalculateRatings'
import { saveRatingSnapshotBatches } from './rating-snapshot-batches'
import { isWinnerFirstTennisRecordScore } from './tennisrecord-score-orientation'

type Participant = { match_id: string; player_id: string; side: 'A' | 'B' }
type ReceiptParticipant = { sourcePlayerKey?: string; side?: string; seat?: number }
type Receipt = { source: string; score_text: string | null; winner_side: string | null; participants: ReceiptParticipant[] }
const normalizeScore = (score: string) => score.replace(/;/g, ' ').replace(/\s+/g, ' ').trim()

/** Exact source ownership on a retained winning receipt; never a name or rating match. */
export function isSourceOwnedCourt(match: MatchRow, lineup: Participant[], receipt: Receipt, excluded: ReadonlySet<string>, owners: ReadonlyMap<string, string>) {
  if (match.source !== 'tennisrecord' || !match.external_match_id?.startsWith('tennisrecord:') || receipt.source !== 'tennisrecord') return false
  if (!receipt.score_text || match.winner_side !== receipt.winner_side) return false
  const rawScore = normalizeScore(receipt.score_text)
  const winnerFirst = receipt.winner_side === 'B' && isWinnerFirstTennisRecordScore(rawScore, 'B')
  const sameScore = normalizeScore(match.score) === rawScore
  const alreadyOriented = winnerFirst && parseScoreMetrics(match.score, 'B').parsed && normalizeScore(match.score) === rawScore.replace(/(\d+)-(\d+)/g, '$2-$1')
  if (!sameScore && !alreadyOriented) return false
  const count = match.match_type === 'singles' ? 1 : match.match_type === 'doubles' ? 2 : 0
  const rows = receipt.participants
  if (!count || !Array.isArray(rows) || rows.length !== count * 2 || lineup.length !== count * 2) return false
  if (rows.some(p => !p || typeof p !== 'object')) return false
  if (new Set(rows.map(p => p.sourcePlayerKey)).size !== rows.length || new Set(rows.map(p => `${p.side}:${p.seat}`)).size !== rows.length) return false
  if (rows.some(p => !p.sourcePlayerKey || !['A', 'B'].includes(p.side ?? '') || !Number.isInteger(p.seat) || p.seat! < 1 || p.seat! > count)) return false
  const collisions = lineup.filter(p => excluded.has(p.player_id))
  return collisions.length > 0 && collisions.every(p => {
    const key = owners.get(p.player_id)
    return !!key && rows.some(r => r.sourcePlayerKey === key && r.side === p.side)
  })
}

export async function loadSourceOwnedCourts(client: SupabaseClient, matches: MatchRow[], participants: Participant[], excluded: ReadonlySet<string>) {
  const byMatch = new Map<string, Participant[]>()
  for (const p of participants) { const rows = byMatch.get(p.match_id) ?? []; rows.push(p); byMatch.set(p.match_id, rows) }
  const candidates = matches.filter(m => m.source === 'tennisrecord' && (byMatch.get(m.id) ?? []).some(p => excluded.has(p.player_id)))
  const ids = [...new Set(candidates.flatMap(m => (byMatch.get(m.id) ?? []).filter(p => excluded.has(p.player_id)).map(p => p.player_id)))]
  const owners = new Map<string, string>()
  const batches = <T,>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
  await saveRatingSnapshotBatches(batches(ids, 50), async batch => {
    const [players, links] = await Promise.all([
      client.from('players').select('id,external_source,external_source_key').in('id', batch),
      client.from('tennisrecord_player_identities').select('canonical_player_id,status,tennisrecord_staged_players(source_player_key)').in('canonical_player_id', batch),
    ])
    if (players.error || links.error) throw new Error('Source court ownership: ' + (players.error?.message ?? links.error?.message))
    if ((links.data?.length ?? 0) >= 1000) return // Incomplete evidence cannot authorize a court.
    for (const player of players.data ?? []) {
      if (player.external_source !== 'tennisrecord' || !player.external_source_key) continue
      const primary = (links.data ?? []).filter(link => {
        const staged = link.tennisrecord_staged_players as unknown as { source_player_key: string } | null
        return link.canonical_player_id === player.id && staged?.source_player_key === player.external_source_key
      })
      if (primary.length === 1 && primary[0].status === 'matched') owners.set(player.id, player.external_source_key)
    }
  }, 4)
  const reviewed = new Set<string>()
  await saveRatingSnapshotBatches(batches(candidates, 100), async batch => {
    const aliases = await client.from('tennisrecord_canonical_matches').select('canonical_match_id,winning_observation_id,winning_source,has_conflict').in('canonical_match_id', batch.map(m => m.id))
    if (aliases.error) throw new Error('Source court alias: ' + aliases.error.message)
    if (!aliases.data?.length || aliases.data.length >= 1000) return
    const observationIds = [...new Set(aliases.data.map(a => a.winning_observation_id).filter(Boolean))]
    if (!observationIds.length) return
    const receipts = await client.from('tennisrecord_match_observations').select('id,source,score_text,winner_side,participants').in('id', observationIds)
    if (receipts.error) throw new Error('Source court receipt: ' + receipts.error.message)
    if ((receipts.data?.length ?? 0) >= 1000) return
    for (const match of batch) {
      const sourceAliases = aliases.data.filter(a => a.canonical_match_id === match.id)
      if (sourceAliases.length !== 1 || sourceAliases[0].has_conflict || sourceAliases[0].winning_source !== 'tennisrecord') continue
      const receipt = receipts.data?.find(r => r.id === sourceAliases[0].winning_observation_id)
      if (receipt && isSourceOwnedCourt(match, byMatch.get(match.id) ?? [], receipt as Receipt, excluded, owners)) reviewed.add(match.id)
    }
  }, 4)
  console.info(JSON.stringify({ event: 'tiq_source_owned_courts', candidates: candidates.length, reviewed: reviewed.size }))
  return reviewed
}
