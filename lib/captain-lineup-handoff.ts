export const CAPTAIN_LINEUP_HANDOFF_STORAGE_KEY = 'tenaceiq_captain_lineup_handoff'

export type CaptainLineupHandoffScenario = {
  id: string
  scenario_name: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  team_name: string | null
  opponent_team: string | null
  slots_json: unknown
  notes: string | null
}

export type CaptainLineupHandoff = {
  version: 1
  intent: 'confirm-availability'
  scenario: CaptainLineupHandoffScenario
  match: {
    date: string
    time: string
    facility: string
    opponent: string
  }
  availabilityRequestUrl: string
  playerRequestUrls?: Array<{
    playerId: string
    playerName: string
    requestUrl: string
  }>
  createdAt: string
}

type MessageSlot = {
  label: string
  players: string[]
}

export function readCaptainLineupHandoff(raw: string | null): CaptainLineupHandoff | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CaptainLineupHandoff>
    if (parsed.version !== 1 || parsed.intent !== 'confirm-availability' || !parsed.scenario?.id) {
      return null
    }
    return parsed as CaptainLineupHandoff
  } catch {
    return null
  }
}

export function extractPotentialLineupPlayers(slotsJson: unknown) {
  return Array.from(
    new Set(
      normalizeMessageSlots(slotsJson)
        .flatMap((slot) => slot.players)
        .map((name) => name.trim())
        .filter(Boolean)
    )
  )
}

export function buildPotentialLineupAvailabilityMessage(input: {
  teamName: string
  opponent: string
  dateText: string
  time: string
  facility: string
  slotsJson: unknown
  availabilityRequestUrl?: string
}) {
  const lines = normalizeMessageSlots(input.slotsJson)
    .map((slot) => `${slot.label}: ${slot.players.join(' / ') || 'Open'}`)
    .join('\n')
  const details = [
    input.time ? `Time: ${input.time}` : '',
    input.facility ? `Location: ${input.facility}` : '',
  ].filter(Boolean)

  return [
    `Potential lineup for ${input.dateText} vs ${input.opponent || 'the opponent'}:`,
    lines || 'Court assignments are still being worked out.',
    'Can you play? Reply YES, NO, or MAYBE.',
    ...details,
    input.availabilityRequestUrl
      ? `Set this match or other season dates: ${input.availabilityRequestUrl}`
      : 'Your text reply still counts even if you do not use TIQ.',
    input.availabilityRequestUrl
      ? 'The link works without a TIQ account. You can join after responding if you want future availability in one place.'
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * The captain sends this one player at a time. Keep the proposed court private
 * to the recipient: a player needs to know their likely role and doubles
 * partner, not the whole tentative lineup.
 */
export function buildPlayerPotentialLineupAvailabilityMessage(input: {
  playerName: string
  teamName: string
  opponent: string
  dateText: string
  time: string
  facility: string
  slotsJson: unknown
  availabilityRequestUrl?: string
}) {
  const playerName = input.playerName.trim()
  const assignedSlot = normalizeMessageSlots(input.slotsJson).find((slot) =>
    slot.players.some((player) => samePlayerName(player, playerName))
  )
  const partner = assignedSlot?.players.find((player) => !samePlayerName(player, playerName))
  const proposedRole = assignedSlot
    ? `Your proposed court: ${assignedSlot.label}${partner ? ` with ${partner}` : ''}.`
    : 'Your court is being finalized after availability is in.'

  return [
    `Can you play ${input.dateText} vs ${input.opponent || 'the opponent'}?`,
    proposedRole,
    'This is a proposed lineup; your captain will send the final courts after confirmations.',
    input.time ? `Time: ${input.time}` : '',
    input.facility ? `Location: ${input.facility}` : '',
    input.availabilityRequestUrl
      ? `Reply in TIQ: ${input.availabilityRequestUrl}`
      : 'Reply YES, NO, or MAYBE to your captain.',
    input.availabilityRequestUrl ? 'The reply link works without a TIQ account.' : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function normalizeMessageSlots(raw: unknown): MessageSlot[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item, index) => {
    const record = typeof item === 'object' && item !== null
      ? item as Record<string, unknown>
      : {}
    const players = Array.isArray(record.players)
      ? record.players.map((player) => {
          if (typeof player === 'string') return player.trim()
          if (typeof player !== 'object' || player === null) return ''
          const entry = player as Record<string, unknown>
          return typeof entry.playerName === 'string' ? entry.playerName.trim() : ''
        }).filter(Boolean)
      : []

    return {
      label: typeof record.label === 'string' && record.label.trim()
        ? record.label.trim()
        : `Court ${index + 1}`,
      players,
    }
  })
}

function samePlayerName(left: string, right: string) {
  return normalizePlayerName(left) === normalizePlayerName(right)
}

function normalizePlayerName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
