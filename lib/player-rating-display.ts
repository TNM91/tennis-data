export type RatingView = 'overall' | 'singles' | 'doubles'

export type PlayerRatingShape = {
  overall_rating?: number | string | null
  overall_dynamic_rating?: number | null
  overall_usta_dynamic_rating?: number | null
  singles_rating?: number | string | null
  singles_dynamic_rating?: number | null
  singles_usta_dynamic_rating?: number | null
  doubles_rating?: number | string | null
  doubles_dynamic_rating?: number | null
  doubles_usta_dynamic_rating?: number | null
}

export function toRatingNumber(value: number | string | null | undefined, fallback = 3.5) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function getUstaRating(player: PlayerRatingShape | null | undefined, view: RatingView) {
  if (!player) return 3.5
  if (view === 'singles') {
    return toRatingNumber(player.singles_rating ?? player.overall_rating, 3.5)
  }
  if (view === 'doubles') {
    return toRatingNumber(player.doubles_rating ?? player.overall_rating, 3.5)
  }
  return toRatingNumber(player.overall_rating, 3.5)
}

// USTA dynamic: evolves only from USTA-registered matches. Tracks bump/knockdown proximity.
export function getUstaDynamicRating(player: PlayerRatingShape | null | undefined, view: RatingView) {
  if (!player) return 3.5
  if (view === 'singles') {
    return toRatingNumber(
      player.singles_usta_dynamic_rating ?? player.singles_rating ?? player.overall_rating,
      3.5,
    )
  }
  if (view === 'doubles') {
    return toRatingNumber(
      player.doubles_usta_dynamic_rating ?? player.doubles_rating ?? player.overall_rating,
      3.5,
    )
  }
  return toRatingNumber(
    player.overall_usta_dynamic_rating ?? player.overall_rating,
    3.5,
  )
}

// TIQ dynamic: evolves from all matches (USTA + TIQ leagues). The most complete picture.
export function getTiqRating(player: PlayerRatingShape | null | undefined, view: RatingView) {
  if (!player) return 3.5
  if (view === 'singles') {
    return toRatingNumber(player.singles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
  }
  if (view === 'doubles') {
    return toRatingNumber(player.doubles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
  }
  return toRatingNumber(player.overall_dynamic_rating, 3.5)
}

export function formatRatingValue(value: number | string | null | undefined, fallback = 3.5) {
  return toRatingNumber(value, fallback).toFixed(2)
}

export function getRatingViewLabel(view: RatingView) {
  if (view === 'singles') return 'Singles'
  if (view === 'doubles') return 'Doubles'
  return 'Overall'
}
