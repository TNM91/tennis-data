import type { SupabaseClient } from '@supabase/supabase-js'
import { replayRatingNetwork, type NetworkCourt } from './tiq-rating-network'
import { individualAdultDivisionLevel } from './tiq-division-context'
import { selectComputerPriors, type ComputerPriorLabel } from './tiq-computer-priors'
import { parseScoreMetrics, type MatchRow, type RatingSnapshotInsert, type WorkingPlayer } from './recalculateRatings'

export const LIVE_NETWORK_MODEL = 'tiq-network-1.2'
type Participant = { match_id: string; player_id: string; side: 'A' | 'B' }
type Observation = { canonical_player_id: string | null; ntrp: number; designation: string; effective_date: string; source_url: string; tennisrecord_staged_players: { source_url: string; ntrp_label: string; tennisrecord_player_identities: { canonical_player_id: string | null; status: string } } | null }
type Identity = { canonical_player_id: string | null; status: string }
async function pages<T>(client: SupabaseClient, table: string, select: string, filter?: { column: string; value: string | boolean }) {
  const rows: T[] = []
  let cursor: string | null = null
  for (let offset = 0; ; offset += 1000) {
    let query = client.from(table).select(select).order(table === 'tennisrecord_canonical_matches' ? 'fingerprint' : table === 'tennisrecord_player_identities' ? 'staged_player_id' : 'id')
    if (table === 'tennisrecord_ntrp_observations') {
      query = query.limit(1000)
      if (cursor) query = query.gt('id', cursor)
    } else query = query.range(offset, offset + 999)
    if (filter) query = query.eq(filter.column, filter.value)
    const { data, error } = await query
    if (error) throw new Error(`Network rating evidence ${table}: ${error.message}`)
    const page = (data ?? []) as unknown as T[]
    rows.push(...page)
    if (page.length < 1000) return rows
    if (table === 'tennisrecord_ntrp_observations') cursor = (page[page.length - 1] as { id: string }).id
  }
}
export async function loadLiveNetworkEvidence(client: SupabaseClient, season: number) {
  const [identities, observations, conflicts] = await Promise.all([
    pages<Identity>(client, 'tennisrecord_player_identities', 'staged_player_id,canonical_player_id,status'),
    // The two preceding annual labels are valid for every age group. No current-year lookahead.
    Promise.all([1, 2].map(age => pages<Observation>(client, 'tennisrecord_ntrp_observations', 'id,canonical_player_id,ntrp,source_url,designation,effective_date,tennisrecord_staged_players(source_url,ntrp_label,tennisrecord_player_identities(canonical_player_id,status))', { column: 'effective_date', value: `${season - age}-12-31` }))).then(rows => rows.flat()),
    pages<{ canonical_match_id: string }>(client, 'tennisrecord_canonical_matches', 'fingerprint,canonical_match_id', { column: 'has_conflict', value: true }),
  ])
  const counts = new Map<string, number>(), excluded = new Set<string>()
  for (const row of identities) if (row.canonical_player_id && ['matched', 'ambiguous'].includes(row.status)) {
    counts.set(row.canonical_player_id, (counts.get(row.canonical_player_id) ?? 0) + 1)
    if (row.status === 'ambiguous') excluded.add(row.canonical_player_id)
  }
  for (const [id, count] of counts) if (count > 1) excluded.add(id)
  const candidates: ComputerPriorLabel[] = []
  for (const row of observations) {
    const id = row.canonical_player_id, owner = row.tennisrecord_staged_players, link = owner?.tennisrecord_player_identities, level = Number(row.ntrp)
    if (!id || excluded.has(id) || !owner || row.source_url !== owner.source_url || link?.status !== 'matched' || link.canonical_player_id !== id) continue
    candidates.push({ playerId: id, level, designation: row.designation, effectiveDate: row.effective_date, currentLabel: owner.ntrp_label ?? '' })
  }
  const priors = selectComputerPriors(candidates, season)
  return { priors, excluded, conflictedMatches: new Set(conflicts.map(row => row.canonical_match_id)) }
}
export function calculateLiveNetwork(input: { season: number; cutoff: string; matches: MatchRow[]; participants: Participant[]; priors: ReadonlyMap<string, number>; excluded: ReadonlySet<string>; conflictedMatches: ReadonlySet<string>; sourceOwnedCourts?: ReadonlySet<string> }) {
  const participants = new Map<string, Participant[]>(), courts: NetworkCourt[] = [], skipped: { matchId: string; reason: string }[] = [], seen = new Set<string>()
  for (const row of input.participants) { const rows = participants.get(row.match_id) ?? []; rows.push(row); participants.set(row.match_id, rows) }
  for (const match of input.matches) {
    if (match.match_date < `${input.season}-01-01` || match.match_date > input.cutoff) continue
    const lineup = participants.get(match.id) ?? [], count = match.match_type === 'singles' ? 1 : match.match_type === 'doubles' ? 2 : 0
    let reason = ''
    if (seen.has(match.id)) reason = 'duplicate'
    else if (match.rating_eligible !== true || !['usta', 'tiq_team', 'tiq_individual', 'tiq_tournament'].includes(match.match_source ?? '')) reason = 'ineligible_source'
    else if (input.conflictedMatches.has(match.id)) reason = 'source_conflict'
    else if (!count || !['A', 'B'].includes(match.winner_side) || lineup.length !== count * 2 || new Set(lineup.map(p => p.player_id)).size !== count * 2 || lineup.some(p => !p.player_id || !['A', 'B'].includes(p.side)) || ['A', 'B'].some(side => lineup.filter(p => p.side === side).length !== count)) reason = 'incomplete_lineup'
    else if (lineup.some(p => input.excluded.has(p.player_id)) && !input.sourceOwnedCourts?.has(match.id)) reason = 'unresolved_identity'
    else if (/\b(default|walkover|retired|retirement|w\/o)\b/i.test(match.score)) reason = 'incomplete_score'
    seen.add(match.id)
    const score = parseScoreMetrics(match.score, match.winner_side)
    if (!reason && (!score.parsed || score.totalGames < 6)) reason = 'unusable_score'
    if (reason) { skipped.push({ matchId: match.id, reason }); continue }
    const division = match.match_source === 'usta' ? individualAdultDivisionLevel(match.league_name ?? '', input.season) : null
    courts.push({ id: match.id, date: match.match_date, format: match.match_type, participants: lineup.map(p => ({ playerId: p.player_id, side: p.side })), actualGameShare: score.totalGamesA / score.totalGames, ...(division === null ? {} : { divisionLevel: division }) })
  }
  const snapshots: RatingSnapshotInsert[] = []
  const result = replayRatingNetwork({ startsOn: `${input.season}-01-01`, cutoff: input.cutoff, priors: input.priors, courts, config: { divisionContextWeight: 0.75 }, onDay: ({ date, courts: dayCourts, states, previous }) => {
    const overall = (id: string, before: boolean) => {
      const ss = ['singles', 'doubles'].map(f => before ? previous.get(`${id}:${f}`) : states.get(`${id}:${f}`)).filter(s => s !== undefined)
      const count = ss.reduce((sum, s) => sum + s.matches, 0)
      return count ? ss.reduce((sum, s) => sum + s.strength * s.matches, 0) / count : ss.length ? ss.reduce((sum, s) => sum + s.strength, 0) / ss.length : null
    }
    for (const court of dayCourts) for (const p of court.participants) {
      const state = states.get(`${p.playerId}:${court.format}`)!, old = previous.get(`${p.playerId}:${court.format}`)!
      const opponents = court.participants.filter(o => o.side !== p.side), opponent = opponents.reduce((sum, o) => sum + previous.get(`${o.playerId}:${court.format}`)!.strength, 0) / opponents.length
      for (const type of [court.format, 'overall'] as const) {
        const strength = type === 'overall' ? overall(p.playerId, false)! : state.strength, before = type === 'overall' ? overall(p.playerId, true)! : old.strength
        snapshots.push({ player_id: p.playerId, match_id: court.id, snapshot_date: date, rating_type: type, dynamic_rating: strength, track: 'tiq', delta: strength - before, opponent_rating: opponent, win_probability: null, multiplier: null })
      }
    }
  } })
  return { ...result, snapshots, skippedMatches: [...skipped, ...result.skippedUnanchored.map(matchId => ({ matchId, reason: 'unanchored_network' }))], model: LIVE_NETWORK_MODEL }
}
export function applyLiveNetworkPlayers(players: WorkingPlayer[], result: ReturnType<typeof calculateLiveNetwork>) {
  return players.map(player => {
    const singles = result.states.get(`${player.id}:singles`), doubles = result.states.get(`${player.id}:doubles`), count = (singles?.matches ?? 0) + (doubles?.matches ?? 0)
    if (!count) return player
    return { ...player, singlesDynamic: singles?.strength ?? player.singlesDynamic, doublesDynamic: doubles?.strength ?? player.doublesDynamic, overallDynamic: ((singles?.strength ?? 0) * (singles?.matches ?? 0) + (doubles?.strength ?? 0) * (doubles?.matches ?? 0)) / count }
  })
}


/** Orient only an unchanged winner-first source score with conflict-free winning evidence. */
export async function orientReviewedLiveScores(client: SupabaseClient, matches: MatchRow[]) {
  const candidates = matches.filter(match => match.source === 'tennisrecord' && match.external_match_id?.startsWith('tennisrecord:') && match.winner_side === 'B' && !parseScoreMetrics(match.score, match.winner_side).parsed)
  const oriented = new Map<string, string>(), normalize = (score: string) => score.replace(/;/g, ' ').replace(/\s+/g, ' ').trim()
  const batches: MatchRow[][] = []
  for (let start = 0; start < candidates.length; start += 100) batches.push(candidates.slice(start, start + 100))
  const { saveRatingSnapshotBatches } = await import('./rating-snapshot-batches')
  await saveRatingSnapshotBatches(batches, async batch => {
    const aliases = await client.from('tennisrecord_canonical_matches').select('canonical_match_id,winning_observation_id').in('canonical_match_id', batch.map(m => m.id)).eq('winning_source', 'tennisrecord').eq('has_conflict', false)
    if (aliases.error) throw new Error('Network score provenance: ' + aliases.error.message)
    if (!aliases.data?.length || aliases.data.length >= 1000) return
    const ids = [...new Set(aliases.data.map(a => a.winning_observation_id).filter(Boolean))]
    if (!ids.length) return
    const evidence = await client.from('tennisrecord_match_observations').select('id,source,score_text,winner_side').in('id', ids)
    if (evidence.error) throw new Error('Network winning score evidence: ' + evidence.error.message)
    const byId = new Map((evidence.data ?? []).map(e => [e.id, e]))
    for (const match of batch) {
      const rows = aliases.data.filter(a => a.canonical_match_id === match.id)
      if (!rows.length || rows.some(a => { const e = byId.get(a.winning_observation_id); return !e || e.source !== 'tennisrecord' || e.winner_side !== 'B' || !e.score_text || normalize(e.score_text) !== normalize(match.score) })) continue
      const score = match.score.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$2-$1')
      if (parseScoreMetrics(score, 'B').parsed) oriented.set(match.id, score)
    }
  }, 4)
  console.info(JSON.stringify({ event: 'tiq_network_score_orientation', candidates: candidates.length, oriented: oriented.size }))
  return matches.map(match => oriented.has(match.id) ? { ...match, score: oriented.get(match.id)! } : match)
}
