import { supabase } from './supabase'

type MatchType = 'singles' | 'doubles'
export type MatchSide = 'A' | 'B'

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

type MatchSource = 'usta' | 'tiq_team' | 'tiq_individual'

type MatchRow = {
  id: string
  match_date: string
  match_type: MatchType
  score: string
  winner_side: MatchSide
  match_source: MatchSource
  created_at?: string | null
}

type MatchPlayerRow = {
  match_id: string
  player_id: string
  side: MatchSide
  seat: number | null
}

export type WorkingPlayer = {
  id: string
  name: string
  singlesBase: number
  singlesDynamic: number
  singlesUstaDynamic: number
  doublesBase: number
  doublesDynamic: number
  doublesUstaDynamic: number
  overallBase: number
  overallDynamic: number
  overallUstaDynamic: number
  matchesProcessed: number
  lastMatchDate: string | null
}

type RatingSnapshotInsert = {
  player_id: string
  match_id: string
  snapshot_date: string
  rating_type: 'singles' | 'doubles' | 'overall'
  dynamic_rating: number
  track: 'usta' | 'tiq'
  delta: number
  opponent_rating: number
  win_probability: number
  multiplier: number
}

type ParsedSetScore = {
  sideA: number
  sideB: number
}

export type ScoreMetrics = {
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

export type RatingProgress = {
  current: number
  next: number
  previous: number
  gainedWithinBand: number
  bandWidth: number
  progressPct: number
}

const DEFAULT_RATING = 3.5
const MIN_RATING = 1.5
const MAX_RATING = 7.0

const K_SINGLES = 0.12
const K_DOUBLES = 0.107
const K_OVERALL = 0.052

const RATING_DIVISOR = 0.45
const MAX_MULTIPLIER = 2.02
const MIN_MULTIPLIER = 0.82

const RATING_BANDS = [
  1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0,
] as const

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
        roundRating((singlesBase + doublesBase) / 2),
      )

      return [
        player.id,
        {
          id: player.id,
          name: player.name,
          singlesBase,
          singlesDynamic: singlesBase,
          singlesUstaDynamic: singlesBase,
          doublesBase,
          doublesDynamic: doublesBase,
          doublesUstaDynamic: doublesBase,
          overallBase,
          overallDynamic: overallBase,
          overallUstaDynamic: overallBase,
          matchesProcessed: 0,
          lastMatchDate: null,
        },
      ]
    }),
  )

  const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

  for (const row of matchPlayers) {
    const existing = participantsByMatchId.get(row.match_id) ?? []
    existing.push(row)
    participantsByMatchId.set(row.match_id, existing)
  }

  const snapshotRows: RatingSnapshotInsert[] = []

  const mostRecentDate = matches.length > 0
    ? matches[matches.length - 1].match_date
    : new Date().toISOString().split('T')[0]

  for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
    const match = matches[matchIndex]
    const participants = participantsByMatchId.get(match.id) ?? []

    const sideA = participants
      .filter((p) => p.side === 'A')
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

    const sideB = participants
      .filter((p) => p.side === 'B')
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

    const recencyWeight = getRecencyWeight(match.match_date, mostRecentDate)

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

  applyInactivityDecay(playersById.values())
  await persistPlayerRatings([...playersById.values()])
  await replaceRatingSnapshots(snapshotRows)
}

export function getNextRatingThreshold(currentRating: number): number {
  const current = clampAndRoundRating(currentRating)

  for (const band of RATING_BANDS) {
    if (band > current) return band
  }

  return MAX_RATING
}

export function getPreviousRatingThreshold(currentRating: number): number {
  const current = clampAndRoundRating(currentRating)

  for (let index = RATING_BANDS.length - 1; index >= 0; index -= 1) {
    const band = RATING_BANDS[index]
    if (band < current) return band
  }

  return MIN_RATING
}

export function getRatingProgressToNextLevel(currentRating: number): RatingProgress {
  const current = clampAndRoundRating(currentRating)
  const previous = getPreviousRatingThreshold(current)
  const next = getNextRatingThreshold(current)
  const bandWidth = Math.max(next - previous, 0.5)
  const gainedWithinBand = clampNumber(current - previous, 0, bandWidth)
  const progressPct = roundRating((gainedWithinBand / bandWidth) * 100)

  return {
    current,
    next,
    previous,
    gainedWithinBand: roundRating(gainedWithinBand),
    bandWidth: roundRating(bandWidth),
    progressPct,
  }
}

export function projectHeadToHeadWinProbability(playerRating: number, opponentRating: number): number {
  return roundRating(expectedScore(playerRating, opponentRating) * 100)
}

export function projectDoublesTeamWinProbability(
  teamARatings: number[],
  teamBRatings: number[],
): number {
  const teamA = average(teamARatings)
  const teamB = average(teamBRatings)
  return roundRating(expectedScore(teamA, teamB) * 100)
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
      match_source,
      created_at
    `)
    .not('match_type', 'is', null)
    .not('winner_side', 'is', null)
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
  recencyWeight: number,
) {
  const actualA = match.winner_side === 'A' ? 1 : 0
  const actualB = match.winner_side === 'B' ? 1 : 0
  const scoreMetrics = parseScoreMetrics(match.score, match.winner_side)

  const kA = getProvisionalkMultiplier(playerA.matchesProcessed)
  const kB = getProvisionalkMultiplier(playerB.matchesProcessed)

  // TIQ track — all matches
  const tiqExpectedA = expectedScore(playerA.singlesDynamic, playerB.singlesDynamic)
  const tiqMultiplier = buildMatchMultiplier(scoreMetrics, playerA.singlesDynamic, playerB.singlesDynamic, actualA, actualB, recencyWeight)

  const deltaTiqSinglesA = K_SINGLES * kA * (actualA - tiqExpectedA) * tiqMultiplier.a
  const deltaTiqSinglesB = K_SINGLES * kB * (actualB - (1 - tiqExpectedA)) * tiqMultiplier.b
  const deltaTiqOverallA = K_OVERALL * kA * (actualA - tiqExpectedA) * tiqMultiplier.a
  const deltaTiqOverallB = K_OVERALL * kB * (actualB - (1 - tiqExpectedA)) * tiqMultiplier.b

  const preTiqSinglesA = playerA.singlesDynamic
  const preTiqSinglesB = playerB.singlesDynamic
  const preTiqOverallA = playerA.overallDynamic
  const preTiqOverallB = playerB.overallDynamic

  playerA.singlesDynamic = clampAndRoundRating(playerA.singlesDynamic + deltaTiqSinglesA)
  playerB.singlesDynamic = clampAndRoundRating(playerB.singlesDynamic + deltaTiqSinglesB)
  playerA.overallDynamic = clampAndRoundRating(playerA.overallDynamic + deltaTiqOverallA)
  playerB.overallDynamic = clampAndRoundRating(playerB.overallDynamic + deltaTiqOverallB)

  registerDelta(playerA, match.match_date)
  registerDelta(playerB, match.match_date)

  const wpA = Math.round(tiqExpectedA * 100)
  const wpB = 100 - wpA

  snapshotRows.push(
    buildSnapshot(playerA.id, match.id, match.match_date, 'singles', playerA.singlesDynamic, 'tiq', deltaTiqSinglesA, preTiqSinglesB, wpA, tiqMultiplier.a),
    buildSnapshot(playerB.id, match.id, match.match_date, 'singles', playerB.singlesDynamic, 'tiq', deltaTiqSinglesB, preTiqSinglesA, wpB, tiqMultiplier.b),
    buildSnapshot(playerA.id, match.id, match.match_date, 'overall', playerA.overallDynamic, 'tiq', deltaTiqOverallA, preTiqOverallB, wpA, tiqMultiplier.a),
    buildSnapshot(playerB.id, match.id, match.match_date, 'overall', playerB.overallDynamic, 'tiq', deltaTiqOverallB, preTiqOverallA, wpB, tiqMultiplier.b),
  )

  // USTA track — USTA matches only
  if (match.match_source === 'usta') {
    const ustaExpectedA = expectedScore(playerA.singlesUstaDynamic, playerB.singlesUstaDynamic)
    const ustaMultiplier = buildMatchMultiplier(scoreMetrics, playerA.singlesUstaDynamic, playerB.singlesUstaDynamic, actualA, actualB, recencyWeight)

    const deltaUstaSinglesA = K_SINGLES * kA * (actualA - ustaExpectedA) * ustaMultiplier.a
    const deltaUstaSinglesB = K_SINGLES * kB * (actualB - (1 - ustaExpectedA)) * ustaMultiplier.b
    const deltaUstaOverallA = K_OVERALL * kA * (actualA - ustaExpectedA) * ustaMultiplier.a
    const deltaUstaOverallB = K_OVERALL * kB * (actualB - (1 - ustaExpectedA)) * ustaMultiplier.b

    const preUstaSinglesA = playerA.singlesUstaDynamic
    const preUstaSinglesB = playerB.singlesUstaDynamic
    const preUstaOverallA = playerA.overallUstaDynamic
    const preUstaOverallB = playerB.overallUstaDynamic

    playerA.singlesUstaDynamic = clampAndRoundRating(playerA.singlesUstaDynamic + deltaUstaSinglesA)
    playerB.singlesUstaDynamic = clampAndRoundRating(playerB.singlesUstaDynamic + deltaUstaSinglesB)
    playerA.overallUstaDynamic = clampAndRoundRating(playerA.overallUstaDynamic + deltaUstaOverallA)
    playerB.overallUstaDynamic = clampAndRoundRating(playerB.overallUstaDynamic + deltaUstaOverallB)

    const ustaWpA = Math.round(ustaExpectedA * 100)
    const ustaWpB = 100 - ustaWpA

    snapshotRows.push(
      buildSnapshot(playerA.id, match.id, match.match_date, 'singles', playerA.singlesUstaDynamic, 'usta', deltaUstaSinglesA, preUstaSinglesB, ustaWpA, ustaMultiplier.a),
      buildSnapshot(playerB.id, match.id, match.match_date, 'singles', playerB.singlesUstaDynamic, 'usta', deltaUstaSinglesB, preUstaSinglesA, ustaWpB, ustaMultiplier.b),
      buildSnapshot(playerA.id, match.id, match.match_date, 'overall', playerA.overallUstaDynamic, 'usta', deltaUstaOverallA, preUstaOverallB, ustaWpA, ustaMultiplier.a),
      buildSnapshot(playerB.id, match.id, match.match_date, 'overall', playerB.overallUstaDynamic, 'usta', deltaUstaOverallB, preUstaOverallA, ustaWpB, ustaMultiplier.b),
    )
  }
}

function processDoublesMatch(
  match: MatchRow,
  teamA: WorkingPlayer[],
  teamB: WorkingPlayer[],
  snapshotRows: RatingSnapshotInsert[],
  recencyWeight: number,
) {
  const actualA = match.winner_side === 'A' ? 1 : 0
  const actualB = match.winner_side === 'B' ? 1 : 0
  const scoreMetrics = parseScoreMetrics(match.score, match.winner_side)

  // TIQ track — all matches
  const tiqTeamARating = average(teamA.map((p) => p.doublesDynamic))
  const tiqTeamBRating = average(teamB.map((p) => p.doublesDynamic))
  const tiqTeamAOverall = average(teamA.map((p) => p.overallDynamic))
  const tiqTeamBOverall = average(teamB.map((p) => p.overallDynamic))
  const tiqExpectedA = expectedScore(tiqTeamARating, tiqTeamBRating)
  const tiqMultiplier = buildMatchMultiplier(scoreMetrics, tiqTeamARating, tiqTeamBRating, actualA, actualB, recencyWeight)

  const tiqRawDoublesA = (actualA - tiqExpectedA) * tiqMultiplier.a
  const tiqRawDoublesB = (actualB - (1 - tiqExpectedA)) * tiqMultiplier.b

  const tiqWpA = Math.round(tiqExpectedA * 100)
  const tiqWpB = 100 - tiqWpA

  for (const player of teamA) {
    const k = getProvisionalkMultiplier(player.matchesProcessed)
    const doublesD = K_DOUBLES * k * tiqRawDoublesA
    const overallD = K_OVERALL * k * tiqRawDoublesA
    player.doublesDynamic = clampAndRoundRating(player.doublesDynamic + doublesD)
    player.overallDynamic = clampAndRoundRating(player.overallDynamic + overallD)
    registerDelta(player, match.match_date)
    snapshotRows.push(
      buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesDynamic, 'tiq', doublesD, tiqTeamBRating, tiqWpA, tiqMultiplier.a),
      buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallDynamic, 'tiq', overallD, tiqTeamBOverall, tiqWpA, tiqMultiplier.a),
    )
  }

  for (const player of teamB) {
    const k = getProvisionalkMultiplier(player.matchesProcessed)
    const doublesD = K_DOUBLES * k * tiqRawDoublesB
    const overallD = K_OVERALL * k * tiqRawDoublesB
    player.doublesDynamic = clampAndRoundRating(player.doublesDynamic + doublesD)
    player.overallDynamic = clampAndRoundRating(player.overallDynamic + overallD)
    registerDelta(player, match.match_date)
    snapshotRows.push(
      buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesDynamic, 'tiq', doublesD, tiqTeamARating, tiqWpB, tiqMultiplier.b),
      buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallDynamic, 'tiq', overallD, tiqTeamAOverall, tiqWpB, tiqMultiplier.b),
    )
  }

  // USTA track — USTA matches only
  if (match.match_source === 'usta') {
    const ustaTeamARating = average(teamA.map((p) => p.doublesUstaDynamic))
    const ustaTeamBRating = average(teamB.map((p) => p.doublesUstaDynamic))
    const ustaTeamAOverall = average(teamA.map((p) => p.overallUstaDynamic))
    const ustaTeamBOverall = average(teamB.map((p) => p.overallUstaDynamic))
    const ustaExpectedA = expectedScore(ustaTeamARating, ustaTeamBRating)
    const ustaMultiplier = buildMatchMultiplier(scoreMetrics, ustaTeamARating, ustaTeamBRating, actualA, actualB, recencyWeight)

    const ustaRawDoublesA = (actualA - ustaExpectedA) * ustaMultiplier.a
    const ustaRawDoublesB = (actualB - (1 - ustaExpectedA)) * ustaMultiplier.b

    const ustaWpA = Math.round(ustaExpectedA * 100)
    const ustaWpB = 100 - ustaWpA

    for (const player of teamA) {
      const k = getProvisionalkMultiplier(player.matchesProcessed)
      const doublesD = K_DOUBLES * k * ustaRawDoublesA
      const overallD = K_OVERALL * k * ustaRawDoublesA
      player.doublesUstaDynamic = clampAndRoundRating(player.doublesUstaDynamic + doublesD)
      player.overallUstaDynamic = clampAndRoundRating(player.overallUstaDynamic + overallD)
      snapshotRows.push(
        buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesUstaDynamic, 'usta', doublesD, ustaTeamBRating, ustaWpA, ustaMultiplier.a),
        buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallUstaDynamic, 'usta', overallD, ustaTeamBOverall, ustaWpA, ustaMultiplier.a),
      )
    }

    for (const player of teamB) {
      const k = getProvisionalkMultiplier(player.matchesProcessed)
      const doublesD = K_DOUBLES * k * ustaRawDoublesB
      const overallD = K_OVERALL * k * ustaRawDoublesB
      player.doublesUstaDynamic = clampAndRoundRating(player.doublesUstaDynamic + doublesD)
      player.overallUstaDynamic = clampAndRoundRating(player.overallUstaDynamic + overallD)
      snapshotRows.push(
        buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesUstaDynamic, 'usta', doublesD, ustaTeamARating, ustaWpB, ustaMultiplier.b),
        buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallUstaDynamic, 'usta', overallD, ustaTeamAOverall, ustaWpB, ustaMultiplier.b),
      )
    }
  }
}

function buildSnapshot(
  playerId: string,
  matchId: string,
  snapshotDate: string,
  ratingType: 'singles' | 'doubles' | 'overall',
  dynamicRating: number,
  track: 'usta' | 'tiq',
  delta: number,
  opponentRating: number,
  winProbability: number,
  multiplier: number,
): RatingSnapshotInsert {
  return {
    player_id: playerId,
    match_id: matchId,
    snapshot_date: snapshotDate,
    rating_type: ratingType,
    dynamic_rating: roundRating(dynamicRating),
    track,
    delta: roundRating(delta),
    opponent_rating: roundRating(opponentRating),
    win_probability: winProbability,
    multiplier: roundRating(multiplier),
  }
}

async function persistPlayerRatings(players: WorkingPlayer[]) {
  for (const chunk of chunkArray(players, 200)) {
    const { error } = await supabase
      .from('players')
      .upsert(
        chunk.map((player) => ({
          id: player.id,
          singles_dynamic_rating: roundRating(player.singlesDynamic),
          doubles_dynamic_rating: roundRating(player.doublesDynamic),
          overall_dynamic_rating: roundRating(player.overallDynamic),
          singles_usta_dynamic_rating: roundRating(player.singlesUstaDynamic),
          doubles_usta_dynamic_rating: roundRating(player.doublesUstaDynamic),
          overall_usta_dynamic_rating: roundRating(player.overallUstaDynamic),
        })),
        { onConflict: 'id' },
      )

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

export function parseScoreMetrics(score: string | null | undefined, winnerSide: MatchSide): ScoreMetrics {
  const fallback = buildFallbackScoreMetrics()

  if (!score || typeof score !== 'string') {
    return fallback
  }

  const normalized = normalizeScoreString(score)
  if (!normalized) {
    return fallback
  }

  const setTokens = normalized
    .split(/[;,|]/)
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

    const isTiebreakSet =
      (set.sideA === 7 && set.sideB === 6) ||
      (set.sideB === 7 && set.sideA === 6)

    if (isTiebreakSet) {
      tiebreakSets += 1
    }

    if (winnerGamesInSet === 6 && loserGamesInSet === 0) {
      bagelSets += 1
    }

    if (winnerGamesInSet === 6 && loserGamesInSet === 1) {
      breadstickSets += 1
    }

    if (!isTiebreakSet && Math.abs(set.sideA - set.sideB) <= 2) {
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
      MAX_MULTIPLIER,
    ),
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
  recencyWeight: number,
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

  const expectedCompressionA = clampNumber(
    0.96 + Math.abs(actualA - expectedScore(ratingA, ratingB)) * 0.14,
    0.96,
    1.08,
  )

  const expectedCompressionB = clampNumber(
    0.96 + Math.abs(actualB - expectedScore(ratingB, ratingA)) * 0.14,
    0.96,
    1.08,
  )

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

  // Reject match tiebreaks stored without brackets (e.g. "10-8")
  if (sideA > 7 || sideB > 7) {
    return null
  }

  return { sideA, sideB }
}

function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / RATING_DIVISOR))
}

export function getProvisionalkMultiplier(matchesProcessed: number): number {
  // Smooth linear decay from 2.0 at 0 matches to 1.0 at 30+ matches.
  // Eliminates the sharp step-downs of the old tier system.
  if (matchesProcessed >= 30) return 1.0
  return roundRating(2.0 - matchesProcessed / 30)
}

export function getRecencyWeight(matchDate: string, mostRecentMatchDate: string): number {
  const matchMs = new Date(matchDate).getTime()
  const recentMs = new Date(mostRecentMatchDate).getTime()
  const daysDiff = Math.max(0, (recentMs - matchMs) / (1000 * 60 * 60 * 24))
  // Full weight for current matches, decays linearly to 0.88 for matches 2+ years old
  const progress = 1 - clampNumber(daysDiff / 730, 0, 1)
  return roundRating(clampNumber(0.88 + progress * 0.24, 0.88, 1.12))
}

function registerDelta(player: WorkingPlayer, matchDate: string) {
  player.matchesProcessed += 1
  player.lastMatchDate = matchDate
}

export function applyInactivityDecay(players: IterableIterator<WorkingPlayer>, now = Date.now()) {
  const DECAY_START_DAYS = 90
  const DECAY_RATE_PER_MONTH = 0.02

  for (const player of players) {
    if (!player.lastMatchDate || player.matchesProcessed === 0) continue

    const daysSinceLast = Math.max(
      0,
      (now - new Date(player.lastMatchDate).getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysSinceLast <= DECAY_START_DAYS) continue

    const decayMonths = (daysSinceLast - DECAY_START_DAYS) / 30
    const retainFactor = Math.pow(1 - DECAY_RATE_PER_MONTH, decayMonths)

    player.singlesDynamic = clampAndRoundRating(DEFAULT_RATING + (player.singlesDynamic - DEFAULT_RATING) * retainFactor)
    player.doublesDynamic = clampAndRoundRating(DEFAULT_RATING + (player.doublesDynamic - DEFAULT_RATING) * retainFactor)
    player.overallDynamic = clampAndRoundRating(DEFAULT_RATING + (player.overallDynamic - DEFAULT_RATING) * retainFactor)
    player.singlesUstaDynamic = clampAndRoundRating(DEFAULT_RATING + (player.singlesUstaDynamic - DEFAULT_RATING) * retainFactor)
    player.doublesUstaDynamic = clampAndRoundRating(DEFAULT_RATING + (player.doublesUstaDynamic - DEFAULT_RATING) * retainFactor)
    player.overallUstaDynamic = clampAndRoundRating(DEFAULT_RATING + (player.overallUstaDynamic - DEFAULT_RATING) * retainFactor)
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