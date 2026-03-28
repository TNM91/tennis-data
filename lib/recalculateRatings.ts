import { supabase } from './supabase'

type MatchType = 'singles' | 'doubles'

type Player = {
  id: string
  name: string
  rating: string | number | null
  dynamic_rating?: number | null
  singles_rating?: number | string | null
  singles_dynamic_rating?: number | null
  doubles_rating?: number | string | null
  doubles_dynamic_rating?: number | null
  overall_rating?: number | string | null
  overall_dynamic_rating?: number | null
  location?: string | null
}

type StoredMatch = {
  id: string
  player_id: string
  opponent_id?: string | null
  opponent: string
  result: string
  date: string
  match_type?: MatchType | null
}

type RatingMap = Record<string, number>

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

function normalizeMatchType(value: string | null | undefined): MatchType {
  return value === 'doubles' ? 'doubles' : 'singles'
}

function getMarginBonus(result: string) {
  const normalized = result.replace(/\s/g, '').toUpperCase()

  if (normalized.startsWith('W6-0,6-0') || normalized.startsWith('W6-0;6-0')) return 0.03
  if (normalized.startsWith('W')) return 0.015
  if (normalized.startsWith('L6-0,6-0') || normalized.startsWith('L6-0;6-0')) return -0.03
  if (normalized.startsWith('L')) return -0.015

  return 0
}

function clampRating(value: number) {
  return Math.max(1.5, Math.min(7.0, value))
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function toRatingNumber(value: number | string | null | undefined, fallback = 3.5) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function deriveOverallRating(singles: number, doubles: number) {
  return roundToTwo((singles + doubles) / 2)
}

export async function recalculateDynamicRatings() {
  const { data: playersData, error: playerError } = await supabase
    .from('players')
    .select(`
      id,
      name,
      rating,
      dynamic_rating,
      singles_rating,
      singles_dynamic_rating,
      doubles_rating,
      doubles_dynamic_rating,
      overall_rating,
      overall_dynamic_rating,
      location
    `)

  if (playerError) {
    throw new Error(playerError.message)
  }

  const { data: matchesData, error: matchError } = await supabase
    .from('matches')
    .select('id, player_id, opponent_id, opponent, result, date, match_type')
    .order('date', { ascending: true })
    .order('id', { ascending: true })

  if (matchError) {
    throw new Error(matchError.message)
  }

  const players = (playersData || []) as Player[]
  const matches = (matchesData || []) as StoredMatch[]

  const { error: deleteSnapshotsError } = await supabase
    .from('rating_snapshots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteSnapshotsError) {
    throw new Error(deleteSnapshotsError.message)
  }

  const singlesRatings: RatingMap = {}
  const doublesRatings: RatingMap = {}

  for (const player of players) {
    const fallbackBase = toRatingNumber(player.rating, 3.5)

    singlesRatings[player.id] = toRatingNumber(
      player.singles_rating ?? player.singles_dynamic_rating,
      fallbackBase
    )

    doublesRatings[player.id] = toRatingNumber(
      player.doubles_rating ?? player.doubles_dynamic_rating,
      fallbackBase
    )
  }

  const snapshotRows: {
    player_id: string
    match_id: string
    snapshot_date: string
    dynamic_rating: number
  }[] = []

  for (const match of matches) {
    const matchType = normalizeMatchType(match.match_type)
    const ratingMap = matchType === 'doubles' ? doublesRatings : singlesRatings

    const playerRating = ratingMap[match.player_id]
    if (playerRating === undefined) continue

    let opponentRating = 3.5

    if (match.opponent_id && ratingMap[match.opponent_id] !== undefined) {
      opponentRating = ratingMap[match.opponent_id]
    }

    const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 0.4))
    const actual = match.result.trim().startsWith('W') ? 1 : 0
    const marginBonus = getMarginBonus(match.result)
    const k = 0.08

    const newPlayerRating = clampRating(playerRating + k * (actual - expected) + marginBonus)
    ratingMap[match.player_id] = newPlayerRating

    snapshotRows.push({
      player_id: match.player_id,
      match_id: match.id,
      snapshot_date: match.date,
      dynamic_rating: roundToTwo(newPlayerRating),
    })

    if (match.opponent_id && ratingMap[match.opponent_id] !== undefined) {
      const opponentActual = actual === 1 ? 0 : 1
      const opponentExpected = 1 - expected
      const newOpponentRating = clampRating(
        opponentRating + k * (opponentActual - opponentExpected) - marginBonus
      )

      ratingMap[match.opponent_id] = newOpponentRating

      snapshotRows.push({
        player_id: match.opponent_id,
        match_id: match.id,
        snapshot_date: match.date,
        dynamic_rating: roundToTwo(newOpponentRating),
      })
    }
  }

  for (const chunk of chunkArray(snapshotRows, 500)) {
    const { error } = await supabase
      .from('rating_snapshots')
      .insert(chunk)

    if (error) {
      throw new Error(error.message)
    }
  }

  const playerUpdates = players.map((player) => {
    const singlesDynamic = roundToTwo(
      singlesRatings[player.id] ?? toRatingNumber(player.singles_rating ?? player.rating, 3.5)
    )

    const doublesDynamic = roundToTwo(
      doublesRatings[player.id] ?? toRatingNumber(player.doubles_rating ?? player.rating, 3.5)
    )

    const overallDynamic = deriveOverallRating(singlesDynamic, doublesDynamic)

    return {
      id: player.id,
      singles_dynamic_rating: singlesDynamic,
      doubles_dynamic_rating: doublesDynamic,
      overall_dynamic_rating: overallDynamic,
      dynamic_rating: overallDynamic,
    }
  })

  for (const chunk of chunkArray(playerUpdates, 500)) {
    const { error } = await supabase
      .from('players')
      .upsert(chunk, {
        onConflict: 'id',
      })

    if (error) {
      throw new Error(error.message)
    }
  }
}