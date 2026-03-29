import { supabase } from './supabase'

type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type PlayerRow = {
  id: string
  name: string
  singles_rating: number | null
  singles_dynamic_rating: number | null
  doubles_rating: number | null
  doubles_dynamic_rating: number | null
  overall_rating: number | null
  overall_dynamic_rating: number | null
}

type MatchRow = {
  id: string
  match_date: string
  match_type: MatchType
  score: string
  winner_side: MatchSide
  created_at?: string | null
}

type MatchPlayerRow = {
  match_id: string
  player_id: string
  side: MatchSide
  seat: number | null
}

type WorkingPlayer = {
  id: string
  name: string
  singlesBase: number
  singlesDynamic: number
  doublesBase: number
  doublesDynamic: number
  overallBase: number
  overallDynamic: number
}

type RatingSnapshotInsert = {
  player_id: string
  match_id: string
  snapshot_date: string
  rating_type: 'singles' | 'doubles' | 'overall'
  dynamic_rating: number
}

const DEFAULT_RATING = 3.5

const K_SINGLES = 0.08
const K_DOUBLES = 0.08
const K_OVERALL = 0.04

const RATING_DIVISOR = 0.35

export async function recalculateDynamicRatings() {
  const players = await fetchPlayers()
  const matches = await fetchMatches()
  const matchPlayers = await fetchMatchPlayers()

  const playersById = new Map<string, WorkingPlayer>(
    players.map((player) => [
      player.id,
      {
        id: player.id,
        name: player.name,
        singlesBase: safeNumber(player.singles_rating, DEFAULT_RATING),
        singlesDynamic: safeNumber(
          player.singles_dynamic_rating,
          safeNumber(player.singles_rating, DEFAULT_RATING)
        ),
        doublesBase: safeNumber(player.doubles_rating, DEFAULT_RATING),
        doublesDynamic: safeNumber(
          player.doubles_dynamic_rating,
          safeNumber(player.doubles_rating, DEFAULT_RATING)
        ),
        overallBase: safeNumber(player.overall_rating, DEFAULT_RATING),
        overallDynamic: safeNumber(
          player.overall_dynamic_rating,
          safeNumber(player.overall_rating, DEFAULT_RATING)
        ),
      },
    ])
  )

  const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

  for (const row of matchPlayers) {
    const existing = participantsByMatchId.get(row.match_id) ?? []
    existing.push(row)
    participantsByMatchId.set(row.match_id, existing)
  }

  const snapshotRows: RatingSnapshotInsert[] = []

  for (const match of matches) {
    const participants = participantsByMatchId.get(match.id) ?? []

    const sideA = participants
      .filter((p) => p.side === 'A')
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

    const sideB = participants
      .filter((p) => p.side === 'B')
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

    if (match.match_type === 'singles') {
      if (sideA.length !== 1 || sideB.length !== 1) {
        console.warn(`Skipping singles match ${match.id}: expected 1 player per side.`)
        continue
      }

      const playerA = playersById.get(sideA[0].player_id)
      const playerB = playersById.get(sideB[0].player_id)

      if (!playerA || !playerB) {
        console.warn(`Skipping singles match ${match.id}: missing player(s).`)
        continue
      }

      processSinglesMatch(match, playerA, playerB, snapshotRows)
      continue
    }

    if (match.match_type === 'doubles') {
      if (sideA.length !== 2 || sideB.length !== 2) {
        console.warn(`Skipping doubles match ${match.id}: expected 2 players per side.`)
        continue
      }

      const teamA = sideA
        .map((p) => playersById.get(p.player_id))
        .filter(Boolean) as WorkingPlayer[]

      const teamB = sideB
        .map((p) => playersById.get(p.player_id))
        .filter(Boolean) as WorkingPlayer[]

      if (teamA.length !== 2 || teamB.length !== 2) {
        console.warn(`Skipping doubles match ${match.id}: missing player(s).`)
        continue
      }

      processDoublesMatch(match, teamA, teamB, snapshotRows)
    }
  }

  await persistPlayerRatings([...playersById.values()])
  await replaceRatingSnapshots(snapshotRows)
}

async function fetchPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('players')
    .select(`
      id,
      name,
      singles_rating,
      singles_dynamic_rating,
      doubles_rating,
      doubles_dynamic_rating,
      overall_rating,
      overall_dynamic_rating
    `)

  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`)
  }

  return (data ?? []) as PlayerRow[]
}

async function fetchMatches(): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      match_date,
      match_type,
      score,
      winner_side,
      created_at
    `)
    .order('match_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch matches: ${error.message}`)
  }

  return (data ?? []) as MatchRow[]
}

async function fetchMatchPlayers(): Promise<MatchPlayerRow[]> {
  const { data, error } = await supabase
    .from('match_players')
    .select(`
      match_id,
      player_id,
      side,
      seat
    `)

  if (error) {
    throw new Error(`Failed to fetch match participants: ${error.message}`)
  }

  return (data ?? []) as MatchPlayerRow[]
}

function processSinglesMatch(
  match: MatchRow,
  playerA: WorkingPlayer,
  playerB: WorkingPlayer,
  snapshotRows: RatingSnapshotInsert[]
) {
  const ratingA = playerA.singlesDynamic
  const ratingB = playerB.singlesDynamic

  const expectedA = expectedScore(ratingA, ratingB)
  const expectedB = 1 - expectedA

  const actualA = match.winner_side === 'A' ? 1 : 0
  const actualB = match.winner_side === 'B' ? 1 : 0

  const deltaSinglesA = K_SINGLES * (actualA - expectedA)
  const deltaSinglesB = K_SINGLES * (actualB - expectedB)

  const deltaOverallA = K_OVERALL * (actualA - expectedA)
  const deltaOverallB = K_OVERALL * (actualB - expectedB)

  playerA.singlesDynamic = roundRating(playerA.singlesDynamic + deltaSinglesA)
  playerB.singlesDynamic = roundRating(playerB.singlesDynamic + deltaSinglesB)

  playerA.overallDynamic = roundRating(playerA.overallDynamic + deltaOverallA)
  playerB.overallDynamic = roundRating(playerB.overallDynamic + deltaOverallB)

  snapshotRows.push(
    buildSnapshot(playerA.id, match.id, match.match_date, 'singles', playerA.singlesDynamic),
    buildSnapshot(playerB.id, match.id, match.match_date, 'singles', playerB.singlesDynamic),
    buildSnapshot(playerA.id, match.id, match.match_date, 'overall', playerA.overallDynamic),
    buildSnapshot(playerB.id, match.id, match.match_date, 'overall', playerB.overallDynamic)
  )
}

function processDoublesMatch(
  match: MatchRow,
  teamA: WorkingPlayer[],
  teamB: WorkingPlayer[],
  snapshotRows: RatingSnapshotInsert[]
) {
  const teamARating = average(teamA.map((player) => player.doublesDynamic))
  const teamBRating = average(teamB.map((player) => player.doublesDynamic))

  const expectedA = expectedScore(teamARating, teamBRating)
  const expectedB = 1 - expectedA

  const actualA = match.winner_side === 'A' ? 1 : 0
  const actualB = match.winner_side === 'B' ? 1 : 0

  const deltaDoublesA = K_DOUBLES * (actualA - expectedA)
  const deltaDoublesB = K_DOUBLES * (actualB - expectedB)

  const deltaOverallA = K_OVERALL * (actualA - expectedA)
  const deltaOverallB = K_OVERALL * (actualB - expectedB)

  for (const player of teamA) {
    player.doublesDynamic = roundRating(player.doublesDynamic + deltaDoublesA)
    player.overallDynamic = roundRating(player.overallDynamic + deltaOverallA)

    snapshotRows.push(
      buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesDynamic),
      buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallDynamic)
    )
  }

  for (const player of teamB) {
    player.doublesDynamic = roundRating(player.doublesDynamic + deltaDoublesB)
    player.overallDynamic = roundRating(player.overallDynamic + deltaOverallB)

    snapshotRows.push(
      buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesDynamic),
      buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallDynamic)
    )
  }
}

function buildSnapshot(
  playerId: string,
  matchId: string,
  snapshotDate: string,
  ratingType: 'singles' | 'doubles' | 'overall',
  dynamicRating: number
): RatingSnapshotInsert {
  return {
    player_id: playerId,
    match_id: matchId,
    snapshot_date: snapshotDate,
    rating_type: ratingType,
    dynamic_rating: roundRating(dynamicRating),
  }
}

async function persistPlayerRatings(players: WorkingPlayer[]) {
  for (const chunk of chunkArray(players, 200)) {
    const rows = chunk.map((player) => ({
      id: player.id,
      singles_dynamic_rating: roundRating(player.singlesDynamic),
      doubles_dynamic_rating: roundRating(player.doublesDynamic),
      overall_dynamic_rating: roundRating(player.overallDynamic),
    }))

    const { error } = await supabase
      .from('players')
      .upsert(rows, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to save recalculated player ratings: ${error.message}`)
    }
  }
}

async function replaceRatingSnapshots(snapshotRows: RatingSnapshotInsert[]) {
  const { error: deleteError } = await supabase
    .from('rating_snapshots')
    .delete()
    .not('id', 'is', null)

  if (deleteError) {
    throw new Error(`Failed to clear old rating snapshots: ${deleteError.message}`)
  }

  if (snapshotRows.length === 0) return

  for (const chunk of chunkArray(snapshotRows, 500)) {
    const { error } = await supabase
      .from('rating_snapshots')
      .insert(chunk)

    if (error) {
      throw new Error(`Failed to insert rating snapshots: ${error.message}`)
    }
  }
}

function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / RATING_DIVISOR))
}

function average(values: number[]) {
  if (values.length === 0) return DEFAULT_RATING
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function safeNumber(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function roundRating(value: number) {
  return Math.round(value * 1000) / 1000
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}