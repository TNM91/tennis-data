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
  matchesProcessed: number
  recentDeltas: number[]
}

type RatingSnapshotInsert = {
  player_id: string
  match_id: string
  snapshot_date: string
  rating_type: 'singles' | 'doubles' | 'overall'
  dynamic_rating: number
}

type ParsedSetScore = {
  sideA: number
  sideB: number
}

type ScoreMetrics = {
  parsed: boolean
  sets: ParsedSetScore[]
  totalGamesA: number
  totalGamesB: number
  totalGames: number
  gamesWonByWinner: number
  gamesWonByLoser: number
  gameShareByWinner: number
  straightSetsWin: boolean
  tiebreakSets: number
  bagelSets: number
  breadstickSets: number
  closeSets: number
  decidingSetPlayed: boolean
  dominanceRatio: number
  competitivenessRatio: number
  multiplier: number
}

const DEFAULT_RATING = 3.5

const MIN_RATING = 1.5
const MAX_RATING = 7.0

const K_SINGLES = 0.115
const K_DOUBLES = 0.105
const K_OVERALL = 0.05

const RATING_DIVISOR = 0.45

const MAX_MULTIPLIER = 2.0
const MIN_MULTIPLIER = 0.82

export async function recalculateDynamicRatings() {
  const players = await fetchPlayers()
  const matches = await fetchMatches()
  const matchPlayers = await fetchMatchPlayers()

  const playersById = new Map<string, WorkingPlayer>(
    players.map((player) => {
      const singlesBase = safeNumber(player.singles_rating, DEFAULT_RATING)
      const doublesBase = safeNumber(player.doubles_rating, DEFAULT_RATING)
      const overallBase = safeNumber(
        player.overall_rating,
        roundRating((singlesBase + doublesBase) / 2)
      )

      return [
        player.id,
        {
          id: player.id,
          name: player.name,
          singlesBase,
          singlesDynamic: singlesBase,
          doublesBase,
          doublesDynamic: doublesBase,
          overallBase,
          overallDynamic: overallBase,
          matchesProcessed: 0,
          recentDeltas: [],
        },
      ]
    })
  )

  const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

  for (const row of matchPlayers) {
    const existing = participantsByMatchId.get(row.match_id) ?? []
    existing.push(row)
    participantsByMatchId.set(row.match_id, existing)
  }

  const snapshotRows: RatingSnapshotInsert[] = []

  for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
    const match = matches[matchIndex]
    const participants = participantsByMatchId.get(match.id) ?? []

    const sideA = participants
      .filter((p) => p.side === 'A')
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

    const sideB = participants
      .filter((p) => p.side === 'B')
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

    const recencyWeight = getRecencyWeight(matchIndex, matches.length)

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

      processSinglesMatch(match, playerA, playerB, snapshotRows, recencyWeight)
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

      processDoublesMatch(match, teamA, teamB, snapshotRows, recencyWeight)
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
  snapshotRows: RatingSnapshotInsert[],
  recencyWeight: number
) {
  const ratingA = playerA.singlesDynamic
  const ratingB = playerB.singlesDynamic

  const expectedA = expectedScore(ratingA, ratingB)
  const expectedB = 1 - expectedA

  const actualA = match.winner_side === 'A' ? 1 : 0
  const actualB = match.winner_side === 'B' ? 1 : 0

  const scoreMetrics = parseScoreMetrics(match.score, match.winner_side)
  const multiplier = buildMatchMultiplier(scoreMetrics, ratingA, ratingB, actualA, actualB, recencyWeight)

  const deltaSinglesA = K_SINGLES * (actualA - expectedA) * multiplier.a
  const deltaSinglesB = K_SINGLES * (actualB - expectedB) * multiplier.b

  const deltaOverallA = K_OVERALL * (actualA - expectedA) * multiplier.a
  const deltaOverallB = K_OVERALL * (actualB - expectedB) * multiplier.b

  playerA.singlesDynamic = clampAndRoundRating(playerA.singlesDynamic + deltaSinglesA)
  playerB.singlesDynamic = clampAndRoundRating(playerB.singlesDynamic + deltaSinglesB)

  playerA.overallDynamic = clampAndRoundRating(playerA.overallDynamic + deltaOverallA)
  playerB.overallDynamic = clampAndRoundRating(playerB.overallDynamic + deltaOverallB)

  registerDelta(playerA, deltaSinglesA)
  registerDelta(playerB, deltaSinglesB)

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
  snapshotRows: RatingSnapshotInsert[],
  recencyWeight: number
) {
  const teamARating = average(teamA.map((player) => player.doublesDynamic))
  const teamBRating = average(teamB.map((player) => player.doublesDynamic))

  const expectedA = expectedScore(teamARating, teamBRating)
  const expectedB = 1 - expectedA

  const actualA = match.winner_side === 'A' ? 1 : 0
  const actualB = match.winner_side === 'B' ? 1 : 0

  const scoreMetrics = parseScoreMetrics(match.score, match.winner_side)
  const multiplier = buildMatchMultiplier(scoreMetrics, teamARating, teamBRating, actualA, actualB, recencyWeight)

  const deltaDoublesA = K_DOUBLES * (actualA - expectedA) * multiplier.a
  const deltaDoublesB = K_DOUBLES * (actualB - expectedB) * multiplier.b

  const deltaOverallA = K_OVERALL * (actualA - expectedA) * multiplier.a
  const deltaOverallB = K_OVERALL * (actualB - expectedB) * multiplier.b

  for (const player of teamA) {
    player.doublesDynamic = clampAndRoundRating(player.doublesDynamic + deltaDoublesA)
    player.overallDynamic = clampAndRoundRating(player.overallDynamic + deltaOverallA)
    registerDelta(player, deltaDoublesA)

    snapshotRows.push(
      buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesDynamic),
      buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallDynamic)
    )
  }

  for (const player of teamB) {
    player.doublesDynamic = clampAndRoundRating(player.doublesDynamic + deltaDoublesB)
    player.overallDynamic = clampAndRoundRating(player.overallDynamic + deltaOverallB)
    registerDelta(player, deltaDoublesB)

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
    for (const player of chunk) {
      const { error } = await supabase
        .from('players')
        .update({
          singles_dynamic_rating: roundRating(player.singlesDynamic),
          doubles_dynamic_rating: roundRating(player.doublesDynamic),
          overall_dynamic_rating: roundRating(player.overallDynamic),
        })
        .eq('id', player.id)

      if (error) {
        throw new Error(`Failed to save recalculated player ratings: ${error.message}`)
      }
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

function parseScoreMetrics(score: string | null | undefined, winnerSide: MatchSide): ScoreMetrics {
  const fallback = buildFallbackScoreMetrics()

  if (!score || typeof score !== 'string') {
    return fallback
  }

  const normalized = normalizeScoreString(score)
  if (!normalized) {
    return fallback
  }

  const setTokens = normalized
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter(Boolean)

  const sets: ParsedSetScore[] = []

  for (const token of setTokens) {
    const parsed = parseSetToken(token)
    if (parsed) {
      sets.push(parsed)
    }
  }

  if (sets.length === 0) {
    return fallback
  }

  const totalGamesA = sets.reduce((sum, set) => sum + set.sideA, 0)
  const totalGamesB = sets.reduce((sum, set) => sum + set.sideB, 0)
  const totalGames = totalGamesA + totalGamesB

  if (totalGames <= 0) {
    return fallback
  }

  const winnerGames = winnerSide === 'A' ? totalGamesA : totalGamesB
  const loserGames = winnerSide === 'A' ? totalGamesB : totalGamesA

  const gameShareByWinner = winnerGames / totalGames
  const dominanceRatio = clampNumber((winnerGames - loserGames) / Math.max(totalGames, 1), 0, 1)
  const competitivenessRatio = 1 - dominanceRatio

  let tiebreakSets = 0
  let bagelSets = 0
  let breadstickSets = 0
  let closeSets = 0
  let winnerSetCount = 0
  let loserSetCount = 0

  for (const set of sets) {
    const winnerGamesInSet = winnerSide === 'A' ? set.sideA : set.sideB
    const loserGamesInSet = winnerSide === 'A' ? set.sideB : set.sideA

    if (winnerGamesInSet > loserGamesInSet) {
      winnerSetCount += 1
    } else if (loserGamesInSet > winnerGamesInSet) {
      loserSetCount += 1
    }

    if (
      (set.sideA === 7 && set.sideB >= 5) ||
      (set.sideB === 7 && set.sideA >= 5)
    ) {
      tiebreakSets += 1
    }

    if (winnerGamesInSet === 6 && loserGamesInSet === 0) {
      bagelSets += 1
    }

    if (winnerGamesInSet === 6 && loserGamesInSet === 1) {
      breadstickSets += 1
    }

    if (Math.abs(set.sideA - set.sideB) <= 2) {
      closeSets += 1
    }
  }

  const straightSetsWin = winnerSetCount >= 2 && loserSetCount === 0
  const decidingSetPlayed = sets.length >= 3 || (winnerSetCount > 0 && loserSetCount > 0)

  const multiplier = roundRating(
    clampNumber(
      0.88 +
        dominanceRatio * 0.92 +
        (straightSetsWin ? 0.07 : 0) +
        (decidingSetPlayed ? -0.05 : 0) +
        bagelSets * 0.07 +
        breadstickSets * 0.035 -
        tiebreakSets * 0.04 -
        closeSets * 0.015,
      MIN_MULTIPLIER,
      MAX_MULTIPLIER
    )
  )

  return {
    parsed: true,
    sets,
    totalGamesA,
    totalGamesB,
    totalGames,
    gamesWonByWinner: winnerGames,
    gamesWonByLoser: loserGames,
    gameShareByWinner,
    straightSetsWin,
    tiebreakSets,
    bagelSets,
    breadstickSets,
    closeSets,
    decidingSetPlayed,
    dominanceRatio,
    competitivenessRatio,
    multiplier,
  }
}

function buildFallbackScoreMetrics(): ScoreMetrics {
  return {
    parsed: false,
    sets: [],
    totalGamesA: 0,
    totalGamesB: 0,
    totalGames: 0,
    gamesWonByWinner: 0,
    gamesWonByLoser: 0,
    gameShareByWinner: 0.5,
    straightSetsWin: false,
    tiebreakSets: 0,
    bagelSets: 0,
    breadstickSets: 0,
    closeSets: 0,
    decidingSetPlayed: false,
    dominanceRatio: 0,
    competitivenessRatio: 1,
    multiplier: 1,
  }
}

function buildMatchMultiplier(
  scoreMetrics: ScoreMetrics,
  ratingA: number,
  ratingB: number,
  actualA: number,
  actualB: number,
  recencyWeight: number
) {
  const ratingGap = Math.abs(ratingA - ratingB)
  const strongerSide = ratingA >= ratingB ? 'A' : 'B'
  const winnerSide = actualA === 1 ? 'A' : 'B'

  let upsetBoostA = 1
  let upsetBoostB = 1

  if (winnerSide !== strongerSide) {
    const upsetBoost = 1 + clampNumber(ratingGap / 1.5, 0, 0.28)

    if (winnerSide === 'A') {
      upsetBoostA = upsetBoost
    } else {
      upsetBoostB = upsetBoost
    }
  }

  const expectedCompressionA = clampNumber(0.96 + Math.abs(actualA - expectedScore(ratingA, ratingB)) * 0.14, 0.96, 1.08)
  const expectedCompressionB = clampNumber(0.96 + Math.abs(actualB - expectedScore(ratingB, ratingA)) * 0.14, 0.96, 1.08)

  const baseMultiplier = scoreMetrics.multiplier

  return {
    a: roundRating(baseMultiplier * upsetBoostA * expectedCompressionA * recencyWeight),
    b: roundRating(baseMultiplier * upsetBoostB * expectedCompressionB * recencyWeight),
  }
}

function normalizeScoreString(score: string) {
  return score
    .replace(/\bW\b/gi, '')
    .replace(/\bL\b/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, '')
    .replace(/\/+/g, ',')
    .replace(/:+/g, '-')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/RET|DEF|W\/O|WO|ABD|CANC/gi, '')
    .trim()
}

function parseSetToken(token: string): ParsedSetScore | null {
  const match = token.match(/^(\d+)-(\d+)$/)
  if (!match) return null

  const sideA = Number(match[1])
  const sideB = Number(match[2])

  if (!Number.isFinite(sideA) || !Number.isFinite(sideB)) {
    return null
  }

  if (sideA < 0 || sideB < 0) {
    return null
  }

  return { sideA, sideB }
}

function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / RATING_DIVISOR))
}

function getRecencyWeight(matchIndex: number, totalMatches: number) {
  if (totalMatches <= 1) return 1

  const progress = matchIndex / Math.max(totalMatches - 1, 1)

  return roundRating(clampNumber(0.97 + progress * 0.09, 0.97, 1.06))
}

function registerDelta(player: WorkingPlayer, delta: number) {
  player.matchesProcessed += 1
  player.recentDeltas.push(roundRating(delta))

  if (player.recentDeltas.length > 8) {
    player.recentDeltas.shift()
  }
}

function average(values: number[]) {
  if (values.length === 0) return DEFAULT_RATING
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function safeNumber(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampAndRoundRating(value: number) {
  return roundRating(clampNumber(value, MIN_RATING, MAX_RATING))
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