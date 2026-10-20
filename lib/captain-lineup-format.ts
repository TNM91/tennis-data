import {
  extractTriLevelRatings,
  resolveTeamMatchFormat,
  type TeamMatchFormatId,
} from './competition-format-registry'

export type CaptainLineupSlot = {
  id: string
  label: string
  slotType: 'singles' | 'doubles'
  defaulted?: boolean
  ratingLevel?: number
  players: Array<{
    playerId: string
    playerName: string
  }>
}

// A default is a zero-probability court, rather than an unrated open court.
// This estimates an outright majority of courts; tied scorecards are not wins.
export function getCaptainMatchWinProbability(courtProbabilities: number[]) {
  let outcomes = [1]
  for (const probability of courtProbabilities) {
    const chance = Math.max(0, Math.min(1, probability))
    const next = Array(outcomes.length + 1).fill(0) as number[]
    outcomes.forEach((weight, wins) => {
      next[wins] += weight * (1 - chance)
      next[wins + 1] += weight * chance
    })
    outcomes = next
  }
  return outcomes.slice(Math.floor(courtProbabilities.length / 2) + 1).reduce((sum, value) => sum + value, 0)
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

export function swapCaptainLineupCourtAssignments(
  slots: CaptainLineupSlot[],
  sourceSlotId: string,
  targetSlotId: string,
) {
  const sourceSlot = slots.find((slot) => slot.id === sourceSlotId)
  const targetSlot = slots.find((slot) => slot.id === targetSlotId)

  if (
    !sourceSlot
    || !targetSlot
    || sourceSlot.id === targetSlot.id
    || sourceSlot.slotType !== targetSlot.slotType
    || sourceSlot.players.length !== targetSlot.players.length
  ) {
    return { slots, swapped: false }
  }

  const sourcePlayers = sourceSlot.players.map((player) => ({ ...player }))
  const targetPlayers = targetSlot.players.map((player) => ({ ...player }))

  return {
    swapped: true,
    slots: slots.map((slot) => {
      if (slot.id === sourceSlot.id) return { ...slot, players: targetPlayers }
      if (slot.id === targetSlot.id) return { ...slot, players: sourcePlayers }
      return slot
    }),
  }
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
      ...(matchingSlot.defaulted === true ? { defaulted: true } : {}),
      players: expectedSlot.players.map((_, playerIndex) => ({
        playerId: matchingSlot.defaulted ? '' : matchingSlot.players[playerIndex]?.playerId || '',
        playerName: matchingSlot.defaulted ? '' : matchingSlot.players[playerIndex]?.playerName || '',
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
