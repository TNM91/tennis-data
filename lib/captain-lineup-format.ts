import {
  extractTriLevelRatings,
  resolveTeamMatchFormat,
  type TeamMatchFormatId,
} from './competition-format-registry'

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

export function getTriLevelRatings(leagueName: string, flight: string) {
  return extractTriLevelRatings(leagueName, flight)
}

export function isTriLevelFormat(leagueName: string, flight: string, explicitFormatId?: string | null) {
  const format = resolveTeamMatchFormat({ leagueName, flight, explicitFormatId })
  return format.id === 'tri_level' || format.id === 'mixed_tri_level'
}

export function isPlayerEligibleForCaptainRating(
  playerRating: number | null | undefined,
  courtRating: number | null | undefined
) {
  if (typeof courtRating !== 'number') return true
  return typeof playerRating === 'number' && Math.abs(playerRating - courtRating) < 0.01
}

export function getCaptainLineupFormatKey(
  leagueName: string,
  flight: string,
  explicitFormatId?: TeamMatchFormatId | 'auto' | string | null
) {
  return resolveTeamMatchFormat({ leagueName, flight, explicitFormatId }).formatKey
}

export function buildCaptainLineupSlots(
  leagueName: string,
  flight: string,
  side: 'team' | 'opponent',
  explicitFormatId?: TeamMatchFormatId | 'auto' | string | null
): CaptainLineupSlot[] {
  const format = resolveTeamMatchFormat({ leagueName, flight, explicitFormatId })
  const triLevel = format.id === 'tri_level' || format.id === 'mixed_tri_level'
  const prefix = triLevel
    ? side === 'team' ? 'tl-' : 'otl-'
    : side === 'team' ? '' : 'o'

  return format.slots.map((slot, index) => {
    const disciplineIndex = format.slots
      .slice(0, index + 1)
      .filter((candidate) => candidate.discipline === slot.discipline).length
    const ratingSuffix = typeof slot.ratingLevel === 'number'
      ? `-${String(slot.ratingLevel).replace('.', '-')}`
      : ''
    const id = triLevel && typeof slot.ratingLevel === 'number'
      ? `${prefix}d${ratingSuffix}`
      : `${prefix}${slot.discipline === 'singles' ? 's' : 'd'}${disciplineIndex}${ratingSuffix}`

    return createSlot(id, slot.label, slot.discipline, slot.ratingLevel)
  })
}

export function fitCaptainLineupSlotsToFormat(
  slots: CaptainLineupSlot[],
  leagueName: string,
  flight: string,
  side: 'team' | 'opponent',
  explicitFormatId?: TeamMatchFormatId | 'auto' | string | null
) {
  const resolved = resolveTeamMatchFormat({ leagueName, flight, explicitFormatId })
  const expected = buildCaptainLineupSlots(leagueName, flight, side, explicitFormatId)

  if (resolved.id === 'custom') return slots.length ? slots : expected
  if (resolved.inferredBy === 'default' && !explicitFormatId) return slots.length ? slots : expected

  const usedSlotIds = new Set<string>()
  return expected.map((expectedSlot, index) => {
    const matchingSlot = slots.find((slot) => {
      if (usedSlotIds.has(slot.id)) return false
      if (slot.id === expectedSlot.id) return true
      if (typeof expectedSlot.ratingLevel === 'number') {
        return slot.ratingLevel === expectedSlot.ratingLevel || slot.label.includes(expectedSlot.ratingLevel.toFixed(1))
      }
      return slot.slotType === expectedSlot.slotType && slot.label.toLowerCase() === expectedSlot.label.toLowerCase()
    }) || slots.filter((slot) => !usedSlotIds.has(slot.id) && slot.slotType === expectedSlot.slotType)[indexForDiscipline(expected, index)]

    if (!matchingSlot) return expectedSlot
    usedSlotIds.add(matchingSlot.id)
    return {
      ...expectedSlot,
      players: expectedSlot.players.map((_, playerIndex) => ({
        playerId: matchingSlot.players[playerIndex]?.playerId || '',
        playerName: matchingSlot.players[playerIndex]?.playerName || '',
      })),
    }
  })
}

function indexForDiscipline(slots: CaptainLineupSlot[], index: number) {
  return slots.slice(0, index).filter((slot) => slot.slotType === slots[index].slotType).length
}

function createSlot(
  id: string,
  label: string,
  slotType: 'singles' | 'doubles',
  ratingLevel?: number
): CaptainLineupSlot {
  return {
    id,
    label,
    slotType,
    ...(typeof ratingLevel === 'number' ? { ratingLevel } : {}),
    players:
      slotType === 'doubles'
        ? [
            { playerId: '', playerName: '' },
            { playerId: '', playerName: '' },
          ]
        : [{ playerId: '', playerName: '' }],
  }
}
