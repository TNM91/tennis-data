import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type MatchType = 'singles' | 'doubles'
export type MatchSide = 'A' | 'B'

type PlayerRow = {
  id: string
  name: string
  rating_source?: string | null
  singles_rating: number | null
  singles_dynamic_rating: number | null
  doubles_rating: number | null
  doubles_dynamic_rating: number | null
  overall_rating: number | null
  overall_dynamic_rating: number | null
}

type MatchSource = 'usta' | 'tiq_team' | 'tiq_individual' | 'tiq_tournament'

export type MatchRow = {
  id: string
  external_match_id?: string | null
  match_date: string
  match_type: MatchType
  score: string
  winner_side: MatchSide
  match_source?: MatchSource | null
  rating_eligible?: boolean | null
  created_at?: string | null
  league_name?: string | null
  flight?: string | null
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
  /** A confirmed USTA/NTRP baseline is a strong prior, not a self-rating. */
  hasVerifiedBaseline: boolean
  singlesBase: number
  singlesDynamic: number
  singlesUstaDynamic: number
  doublesBase: number
  doublesDynamic: number
  doublesUstaDynamic: number
  overallBase: number
  overallDynamic: number
  overallUstaDynamic: number
  singlesMatchesProcessed: number
  doublesMatchesProcessed: number
  overallMatchesProcessed: number
  matchesProcessed: number
  lastMatchDate: string | null
}

export type RatingSnapshotInsert = {
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

type LegacyRatingSnapshotInsert = Omit<
  RatingSnapshotInsert,
  'delta' | 'opponent_rating' | 'win_probability' | 'multiplier'
>

type ParsedSetScore = {
  sideA: number
  sideB: number
  /** A deciding match tiebreak shown as `1-0`, not a one-game tennis set. */
  isMatchTiebreak?: boolean
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
const GAME_SHARE_DIVISOR = 1.6
const DATABASE_PAGE_SIZE = 1000

const RATING_BANDS = [
  1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0,
] as const

export type RecalcPhase =
  | 'fetching-players'
  | 'fetching-matches'
  | 'fetching-participants'
  | 'processing'
  | 'finalizing'
  | 'saving-ratings'
  | 'saving-snapshots'
  | 'done'

export type RatingRecalculationOptions = {
  /**
   * Calculate the full cohort without changing player ratings or snapshots.
   * This is intended for admin-safe audits before a production rerun.
   */
  dryRun?: boolean
  now?: number
  /**
   * Full rebuilds can update the existing per-match snapshots in place. This
   * avoids a destructive table-wide delete when a controlled background job
   * is catching up a large imported history.
   */
  replaceSnapshots?: boolean
}

export type RatingRecalculationResult = {
  dryRun: boolean
  playerCount: number
  eligibleMatchCount: number
  snapshotCount: number
  players: WorkingPlayer[]
  snapshots: RatingSnapshotInsert[]
  processedMatchCount: number
  skippedMatches: Array<{ matchId: string; reason: string }>
}

export async function recalculateDynamicRatings(
  onPhase?: (phase: RecalcPhase, detail?: string) => void,
  client: SupabaseClient = supabase,
  options: RatingRecalculationOptions = {},
): Promise<RatingRecalculationResult> {
  onPhase?.('fetching-players')
  const players = await fetchPlayers(client)
  onPhase?.('fetching-matches')
  const matches = await fetchMatches(client)
  onPhase?.('fetching-participants')
  const matchPlayers = await fetchMatchPlayers(client)

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
          hasVerifiedBaseline: player.rating_source === 'verified',
          singlesBase,
          singlesDynamic: singlesBase,
          singlesUstaDynamic: singlesBase,
          doublesBase,
          doublesDynamic: doublesBase,
          doublesUstaDynamic: doublesBase,
          overallBase,
          overallDynamic: overallBase,
          overallUstaDynamic: overallBase,
          singlesMatchesProcessed: 0,
          doublesMatchesProcessed: 0,
          overallMatchesProcessed: 0,
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
  const skippedMatches: Array<{ matchId: string; reason: string }> = []
  let processedMatchCount = 0

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
        const reason = 'expected 1 player per side'
        skippedMatches.push({ matchId: match.id, reason })
        console.warn(`Skipping singles match ${match.id}: ${reason}.`)
        continue
      }

      const playerA = playersById.get(sideA[0].player_id)
      const playerB = playersById.get(sideB[0].player_id)

      if (!playerA || !playerB) {
        const reason = 'missing player(s)'
        skippedMatches.push({ matchId: match.id, reason })
        console.warn(`Skipping singles match ${match.id}: ${reason}.`)
        continue
      }

      processSinglesMatch(match, playerA, playerB, snapshotRows, recencyWeight)
      processedMatchCount += 1
      continue
    }

    if (match.match_type === 'doubles') {
      if (sideA.length !== 2 || sideB.length !== 2) {
        const reason = 'expected 2 players per side'
        skippedMatches.push({ matchId: match.id, reason })
        console.warn(`Skipping doubles match ${match.id}: ${reason}.`)
        continue
      }

      const teamA = sideA
        .map((p) => playersById.get(p.player_id))
        .filter(Boolean) as WorkingPlayer[]

      const teamB = sideB
        .map((p) => playersById.get(p.player_id))
        .filter(Boolean) as WorkingPlayer[]

      if (teamA.length !== 2 || teamB.length !== 2) {
        const reason = 'missing player(s)'
        skippedMatches.push({ matchId: match.id, reason })
        console.warn(`Skipping doubles match ${match.id}: ${reason}.`)
        continue
      }

      processDoublesMatch(match, teamA, teamB, snapshotRows, recencyWeight)
      processedMatchCount += 1
      continue
    }

    skippedMatches.push({ matchId: match.id, reason: `unsupported match type: ${match.match_type}` })
  }

  onPhase?.('processing', `${matches.length} matches`)
  // (processing loop ran above)

  onPhase?.('finalizing')
  applyInactivityDecay(playersById.values(), options.now ?? Date.now())

  const recalculatedPlayers = [...playersById.values()]

  if (!options.dryRun) {
    onPhase?.('saving-ratings', `${players.length} players`)
    await persistPlayerRatings(recalculatedPlayers, client)

    onPhase?.('saving-snapshots', `${snapshotRows.length} snapshots`)
    await replaceRatingSnapshots(snapshotRows, client, options.replaceSnapshots !== false)
  }

  onPhase?.('done')

  return {
    dryRun: Boolean(options.dryRun),
    playerCount: players.length,
    eligibleMatchCount: matches.length,
    snapshotCount: snapshotRows.length,
    players: recalculatedPlayers,
    snapshots: dedupeRatingSnapshots(snapshotRows),
    processedMatchCount,
    skippedMatches,
  }
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

async function fetchPlayers(client: SupabaseClient): Promise<PlayerRow[]> {
  const rows: PlayerRow[] = []
  for (let start = 0; ; start += DATABASE_PAGE_SIZE) {
    const { data, error } = await client
      .from('players')
      .select(`
        id,
        name,
        rating_source,
        singles_rating,
        singles_dynamic_rating,
        doubles_rating,
        doubles_dynamic_rating,
        overall_rating,
        overall_dynamic_rating
      `)
      .order('id', { ascending: true })
      .range(start, start + DATABASE_PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to fetch players: ${error.message}`)
    const page = (data ?? []) as PlayerRow[]
    rows.push(...page)
    if (page.length < DATABASE_PAGE_SIZE) return rows
  }
}

async function fetchMatches(client: SupabaseClient): Promise<MatchRow[]> {
  const rows: MatchRow[] = []
  for (let start = 0; ; start += DATABASE_PAGE_SIZE) {
    const { data, error } = await client
      .from('matches')
      .select(`
        id,
        match_date,
        match_type,
        score,
        winner_side,
        match_source,
        rating_eligible,
        created_at,
        league_name,
        flight
      `)
      .not('match_type', 'is', null)
      .not('winner_side', 'is', null)
      .eq('rating_eligible', true)
      .order('match_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(start, start + DATABASE_PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to fetch matches: ${error.message}`)
    const page = (data ?? []) as MatchRow[]
    rows.push(...page)
    if (page.length < DATABASE_PAGE_SIZE) return rows
  }
}

async function fetchMatchPlayers(client: SupabaseClient): Promise<MatchPlayerRow[]> {
  const rows: MatchPlayerRow[] = []
  for (let start = 0; ; start += DATABASE_PAGE_SIZE) {
    const { data, error } = await client
      .from('match_players')
      .select(`
        match_id,
        player_id,
        side,
        seat
      `)
      .order('match_id', { ascending: true })
      .order('player_id', { ascending: true })
      .order('side', { ascending: true })
      .order('seat', { ascending: true })
      .range(start, start + DATABASE_PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to fetch match participants: ${error.message}`)
    const page = (data ?? []) as MatchPlayerRow[]
    rows.push(...page)
    if (page.length < DATABASE_PAGE_SIZE) return rows
  }
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

  const kSinglesA = getProvisionalkMultiplier(playerA.singlesMatchesProcessed, playerA.hasVerifiedBaseline)
  const kSinglesB = getProvisionalkMultiplier(playerB.singlesMatchesProcessed, playerB.hasVerifiedBaseline)
  const kOverallA = getProvisionalkMultiplier(playerA.overallMatchesProcessed, playerA.hasVerifiedBaseline)
  const kOverallB = getProvisionalkMultiplier(playerB.overallMatchesProcessed, playerB.hasVerifiedBaseline)

  // TIQ track — all matches
  const tiqExpectedA = expectedScore(playerA.singlesDynamic, playerB.singlesDynamic)
  const tiqPerformance = getScoreAwarePerformance(scoreMetrics, match.winner_side, playerA.singlesDynamic, playerB.singlesDynamic)
  const tiqMultiplier = buildMatchMultiplier(playerA.singlesDynamic, playerB.singlesDynamic, actualA, actualB, recencyWeight)

  const deltaTiqSinglesA = K_SINGLES * kSinglesA * tiqPerformance.a * tiqMultiplier.a
  const deltaTiqSinglesB = K_SINGLES * kSinglesB * tiqPerformance.b * tiqMultiplier.b
  const deltaTiqOverallA = K_OVERALL * kOverallA * tiqPerformance.a * tiqMultiplier.a
  const deltaTiqOverallB = K_OVERALL * kOverallB * tiqPerformance.b * tiqMultiplier.b

  const preTiqSinglesA = playerA.singlesDynamic
  const preTiqSinglesB = playerB.singlesDynamic
  const preTiqOverallA = playerA.overallDynamic
  const preTiqOverallB = playerB.overallDynamic

  playerA.singlesDynamic = applyVerifiedBaselineGuard(playerA.singlesDynamic + deltaTiqSinglesA, playerA.singlesBase, playerA.singlesMatchesProcessed, playerA.hasVerifiedBaseline)
  playerB.singlesDynamic = applyVerifiedBaselineGuard(playerB.singlesDynamic + deltaTiqSinglesB, playerB.singlesBase, playerB.singlesMatchesProcessed, playerB.hasVerifiedBaseline)
  playerA.overallDynamic = applyVerifiedBaselineGuard(playerA.overallDynamic + deltaTiqOverallA, playerA.overallBase, playerA.overallMatchesProcessed, playerA.hasVerifiedBaseline)
  playerB.overallDynamic = applyVerifiedBaselineGuard(playerB.overallDynamic + deltaTiqOverallB, playerB.overallBase, playerB.overallMatchesProcessed, playerB.hasVerifiedBaseline)

  const wpA = Math.round(tiqExpectedA * 100)
  const wpB = 100 - wpA

  snapshotRows.push(
      buildSnapshot(playerA.id, match.id, match.match_date, 'singles', playerA.singlesDynamic, 'tiq', playerA.singlesDynamic - preTiqSinglesA, preTiqSinglesB, wpA, tiqMultiplier.a),
      buildSnapshot(playerB.id, match.id, match.match_date, 'singles', playerB.singlesDynamic, 'tiq', playerB.singlesDynamic - preTiqSinglesB, preTiqSinglesA, wpB, tiqMultiplier.b),
      buildSnapshot(playerA.id, match.id, match.match_date, 'overall', playerA.overallDynamic, 'tiq', playerA.overallDynamic - preTiqOverallA, preTiqOverallB, wpA, tiqMultiplier.a),
      buildSnapshot(playerB.id, match.id, match.match_date, 'overall', playerB.overallDynamic, 'tiq', playerB.overallDynamic - preTiqOverallB, preTiqOverallA, wpB, tiqMultiplier.b),
  )

  // USTA track — USTA matches only
  if ((match.match_source ?? 'usta') === 'usta') {
    const ustaExpectedA = expectedScore(playerA.singlesUstaDynamic, playerB.singlesUstaDynamic)
    const ustaPerformance = getScoreAwarePerformance(scoreMetrics, match.winner_side, playerA.singlesUstaDynamic, playerB.singlesUstaDynamic)
    const ustaMultiplier = buildMatchMultiplier(playerA.singlesUstaDynamic, playerB.singlesUstaDynamic, actualA, actualB, recencyWeight)

    const deltaUstaSinglesA = K_SINGLES * kSinglesA * ustaPerformance.a * ustaMultiplier.a
    const deltaUstaSinglesB = K_SINGLES * kSinglesB * ustaPerformance.b * ustaMultiplier.b
    const deltaUstaOverallA = K_OVERALL * kOverallA * ustaPerformance.a * ustaMultiplier.a
    const deltaUstaOverallB = K_OVERALL * kOverallB * ustaPerformance.b * ustaMultiplier.b

    const preUstaSinglesA = playerA.singlesUstaDynamic
    const preUstaSinglesB = playerB.singlesUstaDynamic
    const preUstaOverallA = playerA.overallUstaDynamic
    const preUstaOverallB = playerB.overallUstaDynamic

    playerA.singlesUstaDynamic = applyVerifiedBaselineGuard(playerA.singlesUstaDynamic + deltaUstaSinglesA, playerA.singlesBase, playerA.singlesMatchesProcessed, playerA.hasVerifiedBaseline)
    playerB.singlesUstaDynamic = applyVerifiedBaselineGuard(playerB.singlesUstaDynamic + deltaUstaSinglesB, playerB.singlesBase, playerB.singlesMatchesProcessed, playerB.hasVerifiedBaseline)
    playerA.overallUstaDynamic = applyVerifiedBaselineGuard(playerA.overallUstaDynamic + deltaUstaOverallA, playerA.overallBase, playerA.overallMatchesProcessed, playerA.hasVerifiedBaseline)
    playerB.overallUstaDynamic = applyVerifiedBaselineGuard(playerB.overallUstaDynamic + deltaUstaOverallB, playerB.overallBase, playerB.overallMatchesProcessed, playerB.hasVerifiedBaseline)

    const ustaWpA = Math.round(ustaExpectedA * 100)
    const ustaWpB = 100 - ustaWpA

    snapshotRows.push(
      buildSnapshot(playerA.id, match.id, match.match_date, 'singles', playerA.singlesUstaDynamic, 'usta', playerA.singlesUstaDynamic - preUstaSinglesA, preUstaSinglesB, ustaWpA, ustaMultiplier.a),
      buildSnapshot(playerB.id, match.id, match.match_date, 'singles', playerB.singlesUstaDynamic, 'usta', playerB.singlesUstaDynamic - preUstaSinglesB, preUstaSinglesA, ustaWpB, ustaMultiplier.b),
      buildSnapshot(playerA.id, match.id, match.match_date, 'overall', playerA.overallUstaDynamic, 'usta', playerA.overallUstaDynamic - preUstaOverallA, preUstaOverallB, ustaWpA, ustaMultiplier.a),
      buildSnapshot(playerB.id, match.id, match.match_date, 'overall', playerB.overallUstaDynamic, 'usta', playerB.overallUstaDynamic - preUstaOverallB, preUstaOverallA, ustaWpB, ustaMultiplier.b),
    )
  }

  registerMatchEvidence(playerA, match.match_date, 'singles')
  registerMatchEvidence(playerB, match.match_date, 'singles')
}

export function processDoublesMatch(
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
  const tiqTeamARating = average(teamA.map((p) => competitionAdjustedRating(p, p.doublesDynamic, match)))
  const tiqTeamBRating = average(teamB.map((p) => competitionAdjustedRating(p, p.doublesDynamic, match)))
  const tiqTeamAOverall = average(teamA.map((p) => competitionAdjustedRating(p, p.overallDynamic, match)))
  const tiqTeamBOverall = average(teamB.map((p) => competitionAdjustedRating(p, p.overallDynamic, match)))
  const tiqExpectedA = expectedScore(tiqTeamARating, tiqTeamBRating)
  const tiqPerformance = getScoreAwarePerformance(scoreMetrics, match.winner_side, tiqTeamARating, tiqTeamBRating)
  const tiqMultiplier = buildMatchMultiplier(tiqTeamARating, tiqTeamBRating, actualA, actualB, recencyWeight)

  const tiqRawDoublesA = tiqPerformance.a * tiqMultiplier.a
  const tiqRawDoublesB = tiqPerformance.b * tiqMultiplier.b

  const tiqWpA = Math.round(tiqExpectedA * 100)
  const tiqWpB = 100 - tiqWpA

  for (const player of teamA) {
    const preTiqDoubles = player.doublesDynamic
    const preTiqOverall = player.overallDynamic
    const doublesK = getProvisionalkMultiplier(player.doublesMatchesProcessed, player.hasVerifiedBaseline)
    const overallK = getProvisionalkMultiplier(player.overallMatchesProcessed, player.hasVerifiedBaseline)
    const playerRawResult = applyDoublesPartnerBurdenGuard(
      tiqRawDoublesA,
      player.doublesDynamic,
      teamA.filter((teammate) => teammate.id !== player.id).map((teammate) => teammate.doublesDynamic),
      tiqTeamBRating,
      scoreMetrics,
    )
    const doublesD = K_DOUBLES * doublesK * playerRawResult
    const overallD = K_OVERALL * overallK * playerRawResult
    player.doublesDynamic = applyVerifiedBaselineGuard(player.doublesDynamic + doublesD, player.doublesBase, player.doublesMatchesProcessed, player.hasVerifiedBaseline)
    player.overallDynamic = applyVerifiedBaselineGuard(player.overallDynamic + overallD, player.overallBase, player.overallMatchesProcessed, player.hasVerifiedBaseline)
    snapshotRows.push(
      buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesDynamic, 'tiq', player.doublesDynamic - preTiqDoubles, tiqTeamBRating, tiqWpA, tiqMultiplier.a),
      buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallDynamic, 'tiq', player.overallDynamic - preTiqOverall, tiqTeamBOverall, tiqWpA, tiqMultiplier.a),
    )
  }

  for (const player of teamB) {
    const preTiqDoubles = player.doublesDynamic
    const preTiqOverall = player.overallDynamic
    const doublesK = getProvisionalkMultiplier(player.doublesMatchesProcessed, player.hasVerifiedBaseline)
    const overallK = getProvisionalkMultiplier(player.overallMatchesProcessed, player.hasVerifiedBaseline)
    const playerRawResult = applyDoublesPartnerBurdenGuard(
      tiqRawDoublesB,
      player.doublesDynamic,
      teamB.filter((teammate) => teammate.id !== player.id).map((teammate) => teammate.doublesDynamic),
      tiqTeamARating,
      scoreMetrics,
    )
    const doublesD = K_DOUBLES * doublesK * playerRawResult
    const overallD = K_OVERALL * overallK * playerRawResult
    player.doublesDynamic = applyVerifiedBaselineGuard(player.doublesDynamic + doublesD, player.doublesBase, player.doublesMatchesProcessed, player.hasVerifiedBaseline)
    player.overallDynamic = applyVerifiedBaselineGuard(player.overallDynamic + overallD, player.overallBase, player.overallMatchesProcessed, player.hasVerifiedBaseline)
    snapshotRows.push(
      buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesDynamic, 'tiq', player.doublesDynamic - preTiqDoubles, tiqTeamARating, tiqWpB, tiqMultiplier.b),
      buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallDynamic, 'tiq', player.overallDynamic - preTiqOverall, tiqTeamAOverall, tiqWpB, tiqMultiplier.b),
    )
  }

  // USTA track — USTA matches only
  if ((match.match_source ?? 'usta') === 'usta') {
    const ustaTeamARating = average(teamA.map((p) => competitionAdjustedRating(p, p.doublesUstaDynamic, match)))
    const ustaTeamBRating = average(teamB.map((p) => competitionAdjustedRating(p, p.doublesUstaDynamic, match)))
    const ustaTeamAOverall = average(teamA.map((p) => competitionAdjustedRating(p, p.overallUstaDynamic, match)))
    const ustaTeamBOverall = average(teamB.map((p) => competitionAdjustedRating(p, p.overallUstaDynamic, match)))
    const ustaExpectedA = expectedScore(ustaTeamARating, ustaTeamBRating)
    const ustaPerformance = getScoreAwarePerformance(scoreMetrics, match.winner_side, ustaTeamARating, ustaTeamBRating)
    const ustaMultiplier = buildMatchMultiplier(ustaTeamARating, ustaTeamBRating, actualA, actualB, recencyWeight)

    const ustaRawDoublesA = ustaPerformance.a * ustaMultiplier.a
    const ustaRawDoublesB = ustaPerformance.b * ustaMultiplier.b

    const ustaWpA = Math.round(ustaExpectedA * 100)
    const ustaWpB = 100 - ustaWpA

    for (const player of teamA) {
      const preUstaDoubles = player.doublesUstaDynamic
      const preUstaOverall = player.overallUstaDynamic
      const doublesK = getProvisionalkMultiplier(player.doublesMatchesProcessed, player.hasVerifiedBaseline)
      const overallK = getProvisionalkMultiplier(player.overallMatchesProcessed, player.hasVerifiedBaseline)
      const playerRawResult = applyDoublesPartnerBurdenGuard(
        ustaRawDoublesA,
        player.doublesUstaDynamic,
        teamA.filter((teammate) => teammate.id !== player.id).map((teammate) => teammate.doublesUstaDynamic),
        ustaTeamBRating,
        scoreMetrics,
      )
      const doublesD = K_DOUBLES * doublesK * playerRawResult
      const overallD = K_OVERALL * overallK * playerRawResult
      player.doublesUstaDynamic = applyVerifiedBaselineGuard(player.doublesUstaDynamic + doublesD, player.doublesBase, player.doublesMatchesProcessed, player.hasVerifiedBaseline)
      player.overallUstaDynamic = applyVerifiedBaselineGuard(player.overallUstaDynamic + overallD, player.overallBase, player.overallMatchesProcessed, player.hasVerifiedBaseline)
      snapshotRows.push(
        buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesUstaDynamic, 'usta', player.doublesUstaDynamic - preUstaDoubles, ustaTeamBRating, ustaWpA, ustaMultiplier.a),
        buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallUstaDynamic, 'usta', player.overallUstaDynamic - preUstaOverall, ustaTeamBOverall, ustaWpA, ustaMultiplier.a),
      )
    }

    for (const player of teamB) {
      const preUstaDoubles = player.doublesUstaDynamic
      const preUstaOverall = player.overallUstaDynamic
      const doublesK = getProvisionalkMultiplier(player.doublesMatchesProcessed, player.hasVerifiedBaseline)
      const overallK = getProvisionalkMultiplier(player.overallMatchesProcessed, player.hasVerifiedBaseline)
      const playerRawResult = applyDoublesPartnerBurdenGuard(
        ustaRawDoublesB,
        player.doublesUstaDynamic,
        teamB.filter((teammate) => teammate.id !== player.id).map((teammate) => teammate.doublesUstaDynamic),
        ustaTeamARating,
        scoreMetrics,
      )
      const doublesD = K_DOUBLES * doublesK * playerRawResult
      const overallD = K_OVERALL * overallK * playerRawResult
      player.doublesUstaDynamic = applyVerifiedBaselineGuard(player.doublesUstaDynamic + doublesD, player.doublesBase, player.doublesMatchesProcessed, player.hasVerifiedBaseline)
      player.overallUstaDynamic = applyVerifiedBaselineGuard(player.overallUstaDynamic + overallD, player.overallBase, player.overallMatchesProcessed, player.hasVerifiedBaseline)
      snapshotRows.push(
        buildSnapshot(player.id, match.id, match.match_date, 'doubles', player.doublesUstaDynamic, 'usta', player.doublesUstaDynamic - preUstaDoubles, ustaTeamARating, ustaWpB, ustaMultiplier.b),
        buildSnapshot(player.id, match.id, match.match_date, 'overall', player.overallUstaDynamic, 'usta', player.overallUstaDynamic - preUstaOverall, ustaTeamAOverall, ustaWpB, ustaMultiplier.b),
      )
    }
  }

  for (const player of [...teamA, ...teamB]) {
    registerMatchEvidence(player, match.match_date, 'doubles')
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

async function persistPlayerRatings(players: WorkingPlayer[], client: SupabaseClient) {
  for (const chunk of chunkArray(players, 200)) {
    const fullPayload = chunk.map((player) => ({
      id: player.id,
      name: player.name,
      singles_dynamic_rating: roundRating(player.singlesDynamic),
      doubles_dynamic_rating: roundRating(player.doublesDynamic),
      overall_dynamic_rating: roundRating(player.overallDynamic),
      singles_usta_dynamic_rating: roundRating(player.singlesUstaDynamic),
      doubles_usta_dynamic_rating: roundRating(player.doublesUstaDynamic),
      overall_usta_dynamic_rating: roundRating(player.overallUstaDynamic),
    }))

    const { error } = await client
      .from('players')
      .upsert(fullPayload, { onConflict: 'id' })

    if (error) {
      // USTA rating columns may not be migrated yet — fall back to TIQ-only columns
      if (error.message.includes('usta_dynamic')) {
        const tiqPayload = chunk.map((player) => ({
          id: player.id,
          name: player.name,
          singles_dynamic_rating: roundRating(player.singlesDynamic),
          doubles_dynamic_rating: roundRating(player.doublesDynamic),
          overall_dynamic_rating: roundRating(player.overallDynamic),
        }))
        const { error: fallbackError } = await client
          .from('players')
          .upsert(tiqPayload, { onConflict: 'id' })
        if (fallbackError) {
          throw new Error(`Failed to save recalculated player ratings: ${fallbackError.message}`)
        }
        continue
      }
      throw new Error(`Failed to save recalculated player ratings: ${error.message}`)
    }
  }
}

async function replaceRatingSnapshots(
  snapshotRows: RatingSnapshotInsert[],
  client: SupabaseClient,
  replaceExisting: boolean,
) {
  if (replaceExisting) {
    const { error: deleteError } = await client
      .from('rating_snapshots')
      .delete()
      .not('id', 'is', null)

    if (deleteError) {
      throw new Error(`Failed to clear old rating snapshots: ${deleteError.message}`)
    }
  }

  if (snapshotRows.length === 0) return

  const dedupedRows = Array.from(
    snapshotRows
      .reduce((map, row) => {
        const key = `${row.player_id}__${row.match_id}__${row.rating_type}__${row.track}`
        map.set(key, row)
        return map
      }, new Map<string, RatingSnapshotInsert>())
      .values(),
  )

  for (const chunk of chunkArray(dedupedRows, 500)) {
    const { error } = await client
      .from('rating_snapshots')
      .upsert(chunk, {
        onConflict: 'player_id,match_id,rating_type,track',
      })

    if (error) {
      if (isMissingOnConflictConstraintError(error.message)) {
        await insertRatingSnapshotChunk(chunk, client)
        continue
      }

      // delta/opponent_rating/win_probability/multiplier columns may not be migrated yet
      if (error.message.includes('delta') || error.message.includes('opponent_rating') ||
          error.message.includes('win_probability') || error.message.includes('multiplier')) {
        const stripped = chunk.map(stripSnapshotMetrics)
        const { error: fallbackError } = await client.from('rating_snapshots').upsert(stripped, {
          onConflict: 'player_id,match_id,rating_type,track',
        })
        if (fallbackError && isMissingOnConflictConstraintError(fallbackError.message)) {
          const { error: insertFallbackError } = await client.from('rating_snapshots').insert(stripped)
          if (insertFallbackError) {
            throw new Error(`Failed to insert rating snapshots: ${insertFallbackError.message}`)
          }
          continue
        }
        if (fallbackError) throw new Error(`Failed to insert rating snapshots: ${fallbackError.message}`)
        continue
      }
      throw new Error(`Failed to insert rating snapshots: ${error.message}`)
    }
  }
}

export function dedupeRatingSnapshots(snapshotRows: RatingSnapshotInsert[]) {
  return Array.from(
    snapshotRows
      .reduce((map, row) => {
        const key = `${row.player_id}__${row.match_id}__${row.rating_type}__${row.track}`
        map.set(key, row)
        return map
      }, new Map<string, RatingSnapshotInsert>())
      .values(),
  )
}

function isMissingOnConflictConstraintError(message: string) {
  return message.toLowerCase().includes('no unique or exclusion constraint matching the on conflict specification')
}

async function insertRatingSnapshotChunk(chunk: RatingSnapshotInsert[], client: SupabaseClient) {
  const { error } = await client.from('rating_snapshots').insert(chunk)

  if (!error) return

  if (
    error.message.includes('delta') ||
    error.message.includes('opponent_rating') ||
    error.message.includes('win_probability') ||
    error.message.includes('multiplier')
  ) {
    const stripped = chunk.map(stripSnapshotMetrics)
    const { error: fallbackError } = await client.from('rating_snapshots').insert(stripped)
    if (!fallbackError) return
    throw new Error(`Failed to insert rating snapshots: ${fallbackError.message}`)
  }

  throw new Error(`Failed to insert rating snapshots: ${error.message}`)
}

function stripSnapshotMetrics(snapshot: RatingSnapshotInsert): LegacyRatingSnapshotInsert {
  return {
    player_id: snapshot.player_id,
    match_id: snapshot.match_id,
    snapshot_date: snapshot.snapshot_date,
    rating_type: snapshot.rating_type,
    dynamic_rating: snapshot.dynamic_rating,
    track: snapshot.track,
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

  const scoredSets = sets.filter((set) => !set.isMatchTiebreak)
  const totalGamesA = scoredSets.reduce((sum, set) => sum + set.sideA, 0)
  const totalGamesB = scoredSets.reduce((sum, set) => sum + set.sideB, 0)
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

  for (const set of scoredSets) {
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

  // A declared winner that loses more parsed sets means the score is oriented
  // incorrectly or corrupt. Keep the result eligible, but do not apply a
  // backwards margin-of-victory adjustment.
  if (loserSetCount > winnerSetCount) {
    return fallback
  }

  const straightSetsWin = winnerSetCount >= 2 && loserSetCount === 0
  const decidingSetPlayed = sets.length >= 3 || sets.some((set) => set.isMatchTiebreak) || (winnerSetCount > 0 && loserSetCount > 0)

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

  return {
    a: roundRating(upsetBoostA * recencyWeight),
    b: roundRating(upsetBoostB * recencyWeight),
  }
}

/**
 * Score-aware performance mirrors the public USTA principle: compare the
 * actual game share with the rating-based expected game share. A close loss to
 * a substantially stronger opponent can therefore be a positive performance.
 * When no usable score is available, retain the conservative win/loss fallback.
 */
export function getScoreAwarePerformance(scoreMetrics: ScoreMetrics, winnerSide: MatchSide, ratingA: number, ratingB: number) {
  const outcomeA = winnerSide === 'A' ? 1 : 0
  const outcomeB = 1 - outcomeA

  if (!scoreMetrics.parsed || scoreMetrics.totalGames <= 0) {
    const expectedA = expectedScore(ratingA, ratingB)
    return { a: outcomeA - expectedA, b: outcomeB - (1 - expectedA) }
  }

  const actualGameShareA = scoreMetrics.totalGamesA / scoreMetrics.totalGames
  const expectedGameShareA = expectedGameShare(ratingA, ratingB)
  return {
    a: actualGameShareA - expectedGameShareA,
    b: (1 - actualGameShareA) - (1 - expectedGameShareA),
  }
}

/**
 * Doubles results are assessed at the team level, but a close loss should not
 * pull down the stronger player when their partner materially lowers the
 * team's expected level against a comparable opposing pair. Without point-by-
 * point attribution, this is deliberately a protection—not a speculative
 * bonus or a transfer of rating from the partner.
 */
export function applyDoublesPartnerBurdenGuard(
  rawPerformance: number,
  playerRating: number,
  partnerRatings: number[],
  opponentTeamRating: number,
  scoreMetrics: ScoreMetrics,
) {
  if (
    rawPerformance >= 0 ||
    !scoreMetrics.parsed ||
    scoreMetrics.competitivenessRatio < 0.8
  ) {
    return rawPerformance
  }

  const partnerRating = average(partnerRatings)
  const isCarryingMeaningfullyWeakerPartner = playerRating - partnerRating >= 0.3
  const opponentsAreComparableToThePlayer = opponentTeamRating >= playerRating - 0.25

  return isCarryingMeaningfullyWeakerPartner && opponentsAreComparableToThePlayer
    ? 0
    : rawPerformance
}

export function expectedGameShare(ratingA: number, ratingB: number) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / GAME_SHARE_DIVISOR))
}

function normalizeScoreString(score: string) {
  return score
    .replace(/\bW\b/gi, '')
    .replace(/\bL\b/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*[-:–—]\s*/g, '-')
    .replace(/\s+/g, ',')
    .replace(/\/+/g, ',')
    .replace(/,+/g, ',')
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

  // TennisRecord displays a deciding match tiebreak as 1-0. It decides the
  // match but is not a one-game set and must not distort game-share scoring.
  if ((sideA === 1 && sideB === 0) || (sideA === 0 && sideB === 1)) {
    return { sideA, sideB, isMatchTiebreak: true }
  }

  return { sideA, sideB }
}

/**
 * A court's stated flight is factual match context, not a player rating. When
 * a participant has no verified NTRP baseline yet, do not let the provisional
 * 3.5 default make a 4.5 court look like a lopsided matchup. Verified player
 * ratings remain untouched and TennisRecord's proprietary rating is never used.
 */
export function matchCompetitionRatingFloor(match: Pick<MatchRow, 'league_name' | 'flight'>) {
  const context = [match.flight, match.league_name].filter((value): value is string => Boolean(value)).join(' ')
  const levels = [...context.matchAll(/\b([1-7](?:\.0|\.5))\b/g)].map((value) => Number(value[1]))
  return levels.length ? Math.max(...levels) : null
}

export function competitionAdjustedRating(player: Pick<WorkingPlayer, 'hasVerifiedBaseline'>, dynamicRating: number, match: Pick<MatchRow, 'league_name' | 'flight'>) {
  const floor = matchCompetitionRatingFloor(match)
  if (player.hasVerifiedBaseline || floor === null) return dynamicRating
  return Math.max(dynamicRating, floor)
}

function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / RATING_DIVISOR))
}

export function getProvisionalkMultiplier(matchesProcessed: number, hasVerifiedBaseline = false): number {
  // A confirmed NTRP baseline is already meaningful evidence. New matches
  // should refine it rather than make it swing twice as far as a self-rated
  // player. Self-rated and unknown players retain the faster provisional path.
  if (hasVerifiedBaseline) {
    if (matchesProcessed >= 30) return 1.0
    return roundRating(0.55 + (matchesProcessed / 30) * 0.45)
  }

  // Smooth linear decay from 2.0 at 0 matches to 1.0 at 30+ matches for an
  // unverified baseline. This lets an unknown rating settle as evidence grows.
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

/**
 * Prevent a small or incomplete sample from silently presenting a verified
 * USTA/NTRP player as materially below their confirmed level. Downward signals
 * remain possible, but require sustained evidence and stay intentionally
 * gradual—the behavior users expect from an annual USTA-level projection.
 */
export function applyVerifiedBaselineGuard(
  candidate: number,
  baseline: number,
  matchesProcessed: number,
  hasVerifiedBaseline: boolean,
) {
  if (!hasVerifiedBaseline) return clampAndRoundRating(candidate)

  const allowedDownwardMovement = matchesProcessed < 12
    ? 0
    : matchesProcessed < 30
      ? ((matchesProcessed - 12) / 18) * 0.08
      : Math.min(0.2, 0.08 + ((matchesProcessed - 30) / 30) * 0.12)

  return clampAndRoundRating(Math.max(candidate, baseline - allowedDownwardMovement))
}

function registerMatchEvidence(player: WorkingPlayer, matchDate: string, matchType: MatchType) {
  player.matchesProcessed += 1
  player.overallMatchesProcessed += 1
  if (matchType === 'singles') player.singlesMatchesProcessed += 1
  else player.doublesMatchesProcessed += 1
  player.lastMatchDate = matchDate
}

export function applyInactivityDecay(players: IterableIterator<WorkingPlayer>, now = Date.now()) {
  // Inactivity changes confidence, not demonstrated playing strength. Dynamic
  // ratings and USTA-proximity must move only through eligible match results.
  void players
  void now
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
