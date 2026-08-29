export const CAPTAIN_LINEUP_HANDOFF_STORAGE_KEY = 'tenaceiq_captain_lineup_handoff'
export const CAPTAIN_DIRECT_COURT_TEXT_STORAGE_KEY = 'tenaceiq_captain_direct_court_text'
export const CAPTAIN_LINEUP_DRAFT_STORAGE_KEY = 'tenaceiq_captain_lineup_draft'

export type CaptainLineupHandoffScenario = {
  id: string
  scenario_name: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  team_name: string | null
  opponent_team: string | null
  slots_json: unknown
  opponent_slots_json?: unknown
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
  availabilityRequestId?: string
  playerRequestUrls?: Array<{
    playerId: string
    playerName: string
    requestUrl: string
  }>
  createdAt: string
}

export type CaptainLineupBuilderDraft = {
  competitionLayer: string
  leagueName: string
  flight: string
  teamName: string
  opponentTeam: string
  matchDate: string
  selectedMatchId: string
  matchFormat: string
  scenarioId: string
  scenarioName: string
  notes: string
  teamSlots: unknown
  opponentSlots: unknown
  manualRosterEntries: CaptainLineupManualRosterEntry[]
  updatedAt?: string
}

export type CaptainLineupManualRosterEntry = {
  name: string
  teamName: string
  leagueName: string
  flight: string
}

export type CaptainDirectCourtTextHandoff = {
  version: 1
  courtId: string
  courtLabel: string
  requestId: string
  match: {
    date: string
    time: string
    facility: string
    opponent: string
  }
  slotsJson: unknown
  players: Array<{
    playerId: string
    playerName: string
    requestUrl: string
  }>
  openedPlayerKeys: string[]
  builderDraft?: CaptainLineupBuilderDraft
}

type MessageSlot = {
  label: string
  slotType: 'singles' | 'doubles'
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
      : 'Your text reply still counts even if you do not use TiQ.',
    input.availabilityRequestUrl
      ? 'The link opens to a one-tap Yes or No response. Add this match to your calendar, then set future availability below.'
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function readCaptainDirectCourtTextHandoff(raw: string | null): CaptainDirectCourtTextHandoff | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CaptainDirectCourtTextHandoff>
    if (parsed.version !== 1 || !parsed.courtId || !Array.isArray(parsed.players) || !Array.isArray(parsed.openedPlayerKeys)) {
      return null
    }
    return parsed as CaptainDirectCourtTextHandoff
  } catch {
    return null
  }
}

export function getCaptainLineupDraftStorageKey(userId?: string | null) {
  return `${CAPTAIN_LINEUP_DRAFT_STORAGE_KEY}:${userId?.trim() || 'anonymous'}`
}

export function readCaptainLineupBuilderDraft(raw: string | null): CaptainLineupBuilderDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CaptainLineupBuilderDraft>
    if (!Array.isArray(parsed.teamSlots) || !Array.isArray(parsed.opponentSlots)) return null

    const manualRosterEntries = Array.isArray(parsed.manualRosterEntries)
      ? parsed.manualRosterEntries
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const candidate = entry as Partial<CaptainLineupManualRosterEntry>
          const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
          if (!name) return null
          return {
            name,
            teamName: typeof candidate.teamName === 'string' ? candidate.teamName.trim() : '',
            leagueName: typeof candidate.leagueName === 'string' ? candidate.leagueName.trim() : '',
            flight: typeof candidate.flight === 'string' ? candidate.flight.trim() : '',
          }
        })
        .filter((entry): entry is CaptainLineupManualRosterEntry => Boolean(entry))
        .slice(-80)
      : []

    return {
      competitionLayer: typeof parsed.competitionLayer === 'string' ? parsed.competitionLayer : '',
      leagueName: typeof parsed.leagueName === 'string' ? parsed.leagueName : '',
      flight: typeof parsed.flight === 'string' ? parsed.flight : '',
      teamName: typeof parsed.teamName === 'string' ? parsed.teamName : '',
      opponentTeam: typeof parsed.opponentTeam === 'string' ? parsed.opponentTeam : '',
      matchDate: typeof parsed.matchDate === 'string' ? parsed.matchDate : '',
      selectedMatchId: typeof parsed.selectedMatchId === 'string' ? parsed.selectedMatchId : '',
      matchFormat: typeof parsed.matchFormat === 'string' ? parsed.matchFormat : 'auto',
      scenarioId: typeof parsed.scenarioId === 'string' ? parsed.scenarioId : '',
      scenarioName: typeof parsed.scenarioName === 'string' ? parsed.scenarioName : '',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      teamSlots: parsed.teamSlots,
      opponentSlots: parsed.opponentSlots,
      manualRosterEntries,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    }
  } catch {
    return null
  }
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
    ? partner
      ? `Your proposed court: ${assignedSlot.label} with ${partner}.`
      : assignedSlot.slotType === 'doubles'
        ? `Your proposed court: ${assignedSlot.label}. Your teammate is still being determined.`
        : `Your proposed court: ${assignedSlot.label}.`
    : 'Your court is being finalized after availability is in.'

  return [
    `Can you play ${input.dateText} vs ${input.opponent || 'the opponent'}?`,
    proposedRole,
    'This is a proposed lineup; your captain will send the final courts after confirmations.',
    input.time ? `Time: ${input.time}` : '',
    input.facility ? `Location: ${input.facility}` : '',
    input.availabilityRequestUrl
      ? `Reply in TiQ: ${input.availabilityRequestUrl}`
      : 'Reply YES, NO, or MAYBE to your captain.',
    input.availabilityRequestUrl ? 'One tap answers this match. Add it to your calendar, then set future availability below.' : '',
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
      slotType: record.slotType === 'singles' ? 'singles' : record.slotType === 'doubles' || /doubles/i.test(String(record.label || '')) ? 'doubles' : 'singles',
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
