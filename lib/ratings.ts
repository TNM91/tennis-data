import { supabase } from './supabase'

export type Player = {
  id: string
  name: string
  rating: string
  dynamic_rating?: number | null
  usta_id?: string
  location?: string
}

export type Match = {
  id?: string
  player_id: string
  opponent_id?: string | null
  opponent: string
  result: string
  date: string
}

type RatingMap = Record<string, number>

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

export function reverseResult(result: string) {
  const trimmed = result.trim()

  if (trimmed.startsWith('W')) {
    return trimmed.replace(/^W/, 'L')
  }

  if (trimmed.startsWith('L')) {
    return trimmed.replace(/^L/, 'W')
  }

  return trimmed
}

export async function recalculateDynamicRatings() {
  const { data: playersData, error: playerError } = await supabase
    .from('players')
    .select('*')

  if (playerError) {
    throw new Error(playerError.message)
  }

  const { data: matchesData, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .order('date', { ascending: true })

  if (matchError) {
    throw new Error(matchError.message)
  }

  const players = (playersData || []) as Player[]
  const matches = (matchesData || []) as Match[]

  const ratings: RatingMap = {}

  for (const player of players) {
    ratings[player.id] = parseFloat(player.rating) || 3.0
  }

  const sortedMatches = [...matches].sort((a, b) => a.date.localeCompare(b.date))

  for (const match of sortedMatches) {
    const playerRating = ratings[match.player_id]
    if (playerRating === undefined) continue

    let opponentRating = 3.5

    if (match.opponent_id && ratings[match.opponent_id] !== undefined) {
      opponentRating = ratings[match.opponent_id]
    }

    const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 0.4))
    const actual = match.result.trim().startsWith('W') ? 1 : 0
    const marginBonus = getMarginBonus(match.result)
    const k = 0.08

    const newPlayerRating = playerRating + k * (actual - expected) + marginBonus
    ratings[match.player_id] = clampRating(newPlayerRating)

    if (match.opponent_id && ratings[match.opponent_id] !== undefined) {
      const opponentActual = actual === 1 ? 0 : 1
      const opponentExpected = 1 - expected
      const newOpponentRating =
        opponentRating + k * (opponentActual - opponentExpected) - marginBonus

      ratings[match.opponent_id] = clampRating(newOpponentRating)
    }
  }

  for (const player of players) {
    const dynamicRating = roundToTwo(
      ratings[player.id] ?? parseFloat(player.rating) ?? 3.0
    )

    const { error } = await supabase
      .from('players')
      .update({ dynamic_rating: dynamicRating })
      .eq('id', player.id)

    if (error) {
      throw new Error(error.message)
    }
  }
}