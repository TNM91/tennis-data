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
