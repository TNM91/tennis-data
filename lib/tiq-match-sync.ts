import { supabase } from './supabase'
import type { TiqTeamMatchEventRecord, TiqTeamMatchLineRecord } from './tiq-team-results-service'

type TiqIndividualResult = {
  id: string
  league_id: string
  player_a_id: string | null
  player_a_name: string
  player_b_id: string | null
  player_b_name: string
  winner_player_id: string | null
  winner_player_name: string
  score: string
  result_date: string
}

export function deriveWinnerSide(result: TiqIndividualResult): 'A' | 'B' | null {
  if (result.winner_player_id) {
    if (result.winner_player_id === result.player_a_id) return 'A'
    if (result.winner_player_id === result.player_b_id) return 'B'
  }
  if (result.winner_player_name === result.player_a_name) return 'A'
  if (result.winner_player_name === result.player_b_name) return 'B'
  return null
}

function buildTiqIndividualExternalMatchId(resultId: string) {
  return `tiq_ind_${resultId}`
}

function buildTiqTeamLineExternalMatchId(lineId: string) {
  return `tiq_team_line_${lineId}`
}

export function normalizePlayerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

// Resolves a player by id or name, creating a placeholder if not found.
async function resolvePlayer(
  playerId: string | null,
  playerName: string,
): Promise<string | null> {
  const name = normalizePlayerName(playerName)
  if (!name) return null

  if (playerId) {
    const { data } = await supabase.from('players').select('id').eq('id', playerId).maybeSingle()
    if (data?.id) return data.id
  }

  // Case-insensitive exact match on the normalized name
  const { data: byName } = await supabase
    .from('players')
    .select('id')
    .ilike('name', name)
    .maybeSingle()

  if (byName?.id) return byName.id

  // Fallback: try with extra internal whitespace collapsed via Postgres regexp
  const { data: byNormalized } = await supabase
    .from('players')
    .select('id')
    .ilike('name', `%${name.split(' ').join('%')}%`)
    .maybeSingle()

  if (byNormalized?.id) return byNormalized.id

  const { data: created, error } = await supabase
    .from('players')
    .insert({ name })
    .select('id')
    .single()

  if (error || !created?.id) return null
  return created.id
}

// ─── Individual results ───────────────────────────────────────────────────────

export async function syncTiqIndividualResultToMatch(result: TiqIndividualResult): Promise<void> {
  const winnerSide = deriveWinnerSide(result)
  if (!winnerSide) {
    throw new Error(`Cannot determine winner side for TIQ result ${result.id}`)
  }

  const externalMatchId = buildTiqIndividualExternalMatchId(result.id)
  const matchDate = result.result_date.slice(0, 10)

  const { data: upsertedMatch, error: matchError } = await supabase
    .from('matches')
    .upsert(
      {
        external_match_id: externalMatchId,
        match_date: matchDate,
        match_time: null,
        home_team: null,
        away_team: null,
        facility: null,
        league_name: result.league_id,
        flight: null,
        usta_section: null,
        district_area: null,
        source: 'tiq',
        status: 'completed',
        match_source: 'tiq_individual',
        match_type: 'singles',
        winner_side: winnerSide,
        score: result.score || null,
        line_number: null,
        dedupe_key: null,
      },
      { onConflict: 'external_match_id' },
    )
    .select('id')
    .single()

  if (matchError || !upsertedMatch?.id) {
    throw new Error(`Failed to sync TIQ individual result to matches: ${matchError?.message ?? 'no id returned'}`)
  }

  const matchId = upsertedMatch.id
  const [playerAId, playerBId] = await Promise.all([
    resolvePlayer(result.player_a_id, result.player_a_name),
    resolvePlayer(result.player_b_id, result.player_b_name),
  ])

  if (!playerAId || !playerBId) {
    throw new Error(`Failed to resolve players for TIQ result ${result.id}`)
  }

  await supabase.from('match_players').delete().eq('match_id', matchId)
  const { error: playersError } = await supabase.from('match_players').insert([
    { match_id: matchId, player_id: playerAId, side: 'A', seat: 1 },
    { match_id: matchId, player_id: playerBId, side: 'B', seat: 1 },
  ])

  if (playersError) {
    throw new Error(`Failed to insert match_players for TIQ result ${result.id}: ${playersError.message}`)
  }
}

export async function deleteTiqIndividualResultMatch(resultId: string): Promise<void> {
  await supabase
    .from('matches')
    .delete()
    .eq('external_match_id', buildTiqIndividualExternalMatchId(resultId))
}

// ─── Team match lines ─────────────────────────────────────────────────────────

export async function syncTiqTeamMatchLineToMatch(
  line: TiqTeamMatchLineRecord,
  event: TiqTeamMatchEventRecord,
): Promise<void> {
  if (!line.winnerSide) {
    throw new Error(`Cannot sync incomplete team line ${line.id} — no winner set`)
  }

  const externalMatchId = buildTiqTeamLineExternalMatchId(line.id)

  const { data: upsertedMatch, error: matchError } = await supabase
    .from('matches')
    .upsert(
      {
        external_match_id: externalMatchId,
        match_date: event.matchDate,
        match_time: null,
        home_team: event.teamAName || null,
        away_team: event.teamBName || null,
        facility: event.facility || null,
        league_name: event.leagueId,
        flight: null,
        usta_section: null,
        district_area: null,
        source: 'tiq',
        status: 'completed',
        match_source: 'tiq_team',
        match_type: line.matchType,
        winner_side: line.winnerSide,
        score: line.score || null,
        line_number: String(line.lineNumber),
        dedupe_key: null,
      },
      { onConflict: 'external_match_id' },
    )
    .select('id')
    .single()

  if (matchError || !upsertedMatch?.id) {
    throw new Error(`Failed to sync TIQ team line to matches: ${matchError?.message ?? 'no id returned'}`)
  }

  const matchId = upsertedMatch.id
  await supabase.from('match_players').delete().eq('match_id', matchId)

  const isSingles = line.matchType === 'singles'

  const [a1, a2, b1, b2] = await Promise.all([
    resolvePlayer(line.sideAPlayer1Id || null, line.sideAPlayer1Name),
    isSingles ? Promise.resolve(null) : resolvePlayer(line.sideAPlayer2Id || null, line.sideAPlayer2Name),
    resolvePlayer(line.sideBPlayer1Id || null, line.sideBPlayer1Name),
    isSingles ? Promise.resolve(null) : resolvePlayer(line.sideBPlayer2Id || null, line.sideBPlayer2Name),
  ])

  if (!a1 || !b1) {
    throw new Error(`Failed to resolve required players for TIQ team line ${line.id}`)
  }

  const participantRows = [
    { match_id: matchId, player_id: a1, side: 'A', seat: 1 },
    ...(a2 ? [{ match_id: matchId, player_id: a2, side: 'A', seat: 2 }] : []),
    { match_id: matchId, player_id: b1, side: 'B', seat: 1 },
    ...(b2 ? [{ match_id: matchId, player_id: b2, side: 'B', seat: 2 }] : []),
  ]

  const { error: playersError } = await supabase.from('match_players').insert(participantRows)
  if (playersError) {
    throw new Error(`Failed to insert match_players for TIQ team line ${line.id}: ${playersError.message}`)
  }
}

export async function deleteTiqTeamMatchLineMatch(lineId: string): Promise<void> {
  await supabase
    .from('matches')
    .delete()
    .eq('external_match_id', buildTiqTeamLineExternalMatchId(lineId))
}
