export type CaptainLineupSlot = {
  id: string
  label: string
  slotType: 'singles' | 'doubles'
  ratingLevel?: number
  players: Array<{
    playerId: string
    playerName: string
  }>
}

const TRI_LEVEL_PATTERN = /\btri[\s-]?level\b/i
const RATING_PATTERN = /\b([2-7](?:\.[05])?)\b/g

export function getTriLevelRatings(leagueName: string, flight: string) {
  if (!TRI_LEVEL_PATTERN.test(leagueName)) return []

  const ratings = Array.from(flight.matchAll(RATING_PATTERN), (match) => Number(match[1]))
    .filter((rating) => Number.isFinite(rating))
    .filter((rating, index, values) => values.indexOf(rating) === index)

  return ratings.length === 3 ? ratings.sort((a, b) => a - b) : []
}

export function isTriLevelFormat(leagueName: string, flight: string) {
  return getTriLevelRatings(leagueName, flight).length === 3
}

export function isPlayerEligibleForCaptainRating(
  playerRating: number | null | undefined,
  courtRating: number | null | undefined
) {
  if (typeof courtRating !== 'number') return true
  return typeof playerRating === 'number' && Math.abs(playerRating - courtRating) < 0.01
}

export function getCaptainLineupFormatKey(leagueName: string, flight: string) {
  const ratings = getTriLevelRatings(leagueName, flight)
  return ratings.length ? `tri-level:${ratings.join('/')}` : 'standard'
}

export function buildCaptainLineupSlots(
  leagueName: string,
  flight: string,
  side: 'team' | 'opponent'
): CaptainLineupSlot[] {
  const ratings = getTriLevelRatings(leagueName, flight)

  if (ratings.length) {
    const prefix = side === 'team' ? 'tl' : 'otl'
    return ratings.map((rating) => ({
      id: `${prefix}-d-${String(rating).replace('.', '-')}`,
      label: `${rating.toFixed(1)} Doubles`,
      slotType: 'doubles',
      ratingLevel: rating,
      players: [
        { playerId: '', playerName: '' },
        { playerId: '', playerName: '' },
      ],
    }))
  }

  const prefix = side === 'team' ? '' : 'o'
  return [
    createSlot(`${prefix}s1`, 'Singles 1', 'singles'),
    createSlot(`${prefix}s2`, 'Singles 2', 'singles'),
    createSlot(`${prefix}s3`, 'Singles 3', 'singles'),
    createSlot(`${prefix}d1`, 'Doubles 1', 'doubles'),
    createSlot(`${prefix}d2`, 'Doubles 2', 'doubles'),
  ]
}

function createSlot(
  id: string,
  label: string,
  slotType: 'singles' | 'doubles'
): CaptainLineupSlot {
  return {
    id,
    label,
    slotType,
    players:
      slotType === 'doubles'
        ? [
            { playerId: '', playerName: '' },
            { playerId: '', playerName: '' },
          ]
        : [{ playerId: '', playerName: '' }],
  }
}
