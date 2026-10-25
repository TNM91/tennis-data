import {cleanText} from './captain-formatters'
import type {CaptainLineupSlot} from './captain-lineup-format'
export function normalizeSavedSlots(raw: unknown): CaptainLineupSlot[] {
  if (!raw || !Array.isArray(raw)) return []

  return raw.map((item, index) => {
    const obj =
      typeof item === 'object' && item !== null
        ? (item as Record<string, unknown>)
        : {}

    const slotType = obj.slotType === 'doubles' ? 'doubles' : 'singles'
    const label = cleanText(obj.label) || `Slot ${index + 1}`
    const id = cleanText(obj.id) || `slot-${index + 1}`
    const ratingLevel =
      typeof obj.ratingLevel === 'number' && Number.isFinite(obj.ratingLevel)
        ? obj.ratingLevel
        : undefined

    const rawPlayers = obj.defaulted !== true && Array.isArray(obj.players) ? obj.players : []
    const players = rawPlayers.map((player) => {
      const entry =
        typeof player === 'object' && player !== null
          ? (player as Record<string, unknown>)
          : {}
      return {
        playerId: cleanText(entry.playerId),
        playerName: cleanText(entry.playerName),
      }
    })

    return {
      id,
      label,
      slotType,
      ...(ratingLevel !== undefined ? { ratingLevel } : {}),
      ...(obj.defaulted === true ? { defaulted: true } : {}),
      players:
        slotType === 'doubles'
          ? [
              players[0] ?? { playerId: '', playerName: '' },
              players[1] ?? { playerId: '', playerName: '' },
            ]
          : [players[0] ?? { playerId: '', playerName: '' }],
    }
  })
}

