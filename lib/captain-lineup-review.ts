import { compactAvailabilityToken, expandAvailabilityToken } from './availability-short-links'

export type CaptainLineupReviewPlayer = {
  playerId: string
  playerName: string
}

export type CaptainLineupReviewSlot = {
  id: string
  label: string
  slotType: 'singles' | 'doubles'
  players: CaptainLineupReviewPlayer[]
}

export type CaptainLineupReviewRosterPlayer = {
  id: string
  name: string
}

export type CaptainLineupReviewPayload = {
  token: string
  status: 'pending' | 'submitted' | 'accepted'
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponentTeam: string
  matchTime: string
  facility: string
  scenarioId: string
  slots: CaptainLineupReviewSlot[]
  proposedSlots: CaptainLineupReviewSlot[] | null
  roster: CaptainLineupReviewRosterPlayer[]
  reviewerName: string
  reviewerNote: string
  expiresAt: string
  submittedAt: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function resolveCaptainLineupReviewToken(value: string) {
  const trimmed = clean(value, 80)
  if (uuidPattern.test(trimmed)) return trimmed
  return expandAvailabilityToken(trimmed)
}

export function captainLineupReviewPath(token: string) {
  const code = compactAvailabilityToken(token)
  return code ? `/r/${code}` : `/lineup-review/${encodeURIComponent(token)}`
}

export function captainLineupReviewReturnPath(token: string) {
  const code = compactAvailabilityToken(token)
  return code ? `/p/${code}` : `/captain/lineup-builder?review=${encodeURIComponent(token)}`
}

export function sanitizeCaptainLineupReviewRoster(value: unknown): CaptainLineupReviewRosterPlayer[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, 120).flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const record = candidate as Record<string, unknown>
    const id = clean(record.id ?? record.playerId, 80)
    const name = clean(record.name ?? record.playerName, 160)
    const key = id || name.toLowerCase()
    if (!name || !key || seen.has(key)) return []
    seen.add(key)
    return [{ id, name }]
  })
}

export function sanitizeCaptainLineupReviewSlots(value: unknown): CaptainLineupReviewSlot[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).flatMap((candidate, slotIndex) => {
    if (!candidate || typeof candidate !== 'object') return []
    const record = candidate as Record<string, unknown>
    const slotType = record.slotType === 'singles' ? 'singles' : 'doubles'
    const expectedPlayers = slotType === 'singles' ? 1 : 2
    const rawPlayers = Array.isArray(record.players) ? record.players : []
    const players = Array.from({ length: expectedPlayers }, (_, playerIndex) => {
      const rawPlayer = rawPlayers[playerIndex]
      const playerRecord = rawPlayer && typeof rawPlayer === 'object'
        ? rawPlayer as Record<string, unknown>
        : {}
      return {
        playerId: clean(playerRecord.playerId, 80),
        playerName: clean(playerRecord.playerName, 160),
      }
    })
    return [{
      id: clean(record.id, 80) || `court-${slotIndex + 1}`,
      label: clean(record.label, 100) || `Court ${slotIndex + 1}`,
      slotType,
      players,
    }]
  })
}

export function validateCaptainLineupReviewProposal(
  originalSlots: CaptainLineupReviewSlot[],
  roster: CaptainLineupReviewRosterPlayer[],
  proposedValue: unknown,
) {
  const proposedSlots = sanitizeCaptainLineupReviewSlots(proposedValue)
  if (proposedSlots.length !== originalSlots.length) return null

  const rosterById = new Map(roster.filter((player) => player.id).map((player) => [player.id, player]))
  const rosterByName = new Map(roster.map((player) => [player.name.toLowerCase(), player]))
  const assigned = new Set<string>()
  const normalized = originalSlots.map((original, index) => {
    const proposed = proposedSlots[index]
    if (
      proposed.id !== original.id ||
      proposed.label !== original.label ||
      proposed.slotType !== original.slotType ||
      proposed.players.length !== original.players.length
    ) return null

    const players = proposed.players.map((player) => {
      if (!player.playerId && !player.playerName) return { playerId: '', playerName: '' }
      const rosterPlayer = (player.playerId ? rosterById.get(player.playerId) : null)
        ?? rosterByName.get(player.playerName.toLowerCase())
      if (!rosterPlayer) return null
      const key = rosterPlayer.id || rosterPlayer.name.toLowerCase()
      if (assigned.has(key)) return null
      assigned.add(key)
      return { playerId: rosterPlayer.id, playerName: rosterPlayer.name }
    })
    if (players.some((player) => player === null)) return null
    return { ...original, players: players as CaptainLineupReviewPlayer[] }
  })

  return normalized.some((slot) => slot === null)
    ? null
    : normalized as CaptainLineupReviewSlot[]
}

export function buildCaptainLineupReviewText(input: {
  teamName: string
  opponentTeam: string
  dateText: string
  reviewUrl: string
}) {
  return [
    `Can you review this potential ${input.teamName || 'team'} lineup${input.opponentTeam ? ` vs ${input.opponentTeam}` : ''}${input.dateText ? ` for ${input.dateText}` : ''}?`,
    'Use this private TiQ link to suggest any swaps. It creates a separate proposal and will not change my lineup.',
    input.reviewUrl,
  ].join('\n\n')
}

export function buildCaptainLineupReviewReturnText(input: {
  reviewerName: string
  teamName: string
  opponentTeam: string
  captainUrl: string
  changedCourts: number
}) {
  const author = input.reviewerName ? `${input.reviewerName} reviewed` : 'I reviewed'
  return [
    `${author} the potential ${input.teamName || 'team'} lineup${input.opponentTeam ? ` vs ${input.opponentTeam}` : ''}.`,
    input.changedCourts
      ? `${input.changedCourts} court${input.changedCourts === 1 ? '' : 's'} changed in the suggestion.`
      : 'No court changes suggested.',
    `Open the proposal in TiQ: ${input.captainUrl}`,
  ].join('\n\n')
}

export function countCaptainLineupReviewChanges(
  original: CaptainLineupReviewSlot[],
  proposed: CaptainLineupReviewSlot[],
) {
  return original.reduce((count, slot, index) => {
    const originalIds = slot.players.map((player) => player.playerId || player.playerName.toLowerCase()).join('|')
    const proposedIds = (proposed[index]?.players ?? []).map((player) => player.playerId || player.playerName.toLowerCase()).join('|')
    return count + (originalIds === proposedIds ? 0 : 1)
  }, 0)
}
