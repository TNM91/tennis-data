import type { SeasonPlayer } from './season-kickoff'

export type AvailabilitySummaryAnswer = { playerId: string; status: string | null; at?: string | null; source: 'player' | 'season' | 'captain' | 'saved' }
export type AvailabilitySummaryPerson = { key: string; name: string; status: 'available' | 'maybe' | 'unavailable' | 'waiting'; source: AvailabilitySummaryAnswer['source'] | null; selected: boolean }

function statusOf(value: string | null): AvailabilitySummaryPerson['status'] {
  if (['available', 'season-available', 'yes', 'confirmed', 'in'].includes(value || '')) return 'available'
  if (['maybe', 'limited'].includes(value || '')) return 'maybe'
  if (['unavailable', 'no', 'out'].includes(value || '')) return 'unavailable'
  return 'waiting'
}

export function selectedLineupPlayers(slots: unknown): string[] {
  if (!Array.isArray(slots)) return []
  return [...new Set(slots.flatMap(slot => Array.isArray(slot?.players) ? slot.players.flatMap((player: { playerId?: unknown }) =>
    typeof player?.playerId === 'string' && player.playerId.trim() ? [player.playerId.trim()] : []) : []))]
}

export function summarizeTeamAvailability(roster: SeasonPlayer[], answers: AvailabilitySummaryAnswer[], selectedIds: string[] | null) {
  const latest = new Map<string, AvailabilitySummaryAnswer>()
  const priority = { saved: 0, captain: 1, season: 2, player: 3 }
  for (const answer of answers) {
    if (!answer.playerId) continue
    const previous = latest.get(answer.playerId)
    const at = Date.parse(answer.at || '') || 0
    const before = Date.parse(previous?.at || '') || 0
    if (!previous || at > before || (at === before && priority[answer.source] > priority[previous.source])) latest.set(answer.playerId, answer)
  }
  const unique = [...new Map(roster.map(player => [player.playerId || player.key, player])).values()]
  const people: AvailabilitySummaryPerson[] = unique.map(player => {
    // Never identify a private reply by name: same-name teammates stay separate.
    const answer = latest.get(player.playerId || `roster:${player.key}`)
    return { key: player.key, name: player.name, status: statusOf(answer?.status || null), source: answer?.source || null,
      selected: Boolean(player.playerId && selectedIds?.includes(player.playerId)) }
  })
  return { people, roster: people.length,
    selectedCount: selectedIds?.length || 0,
    available: people.filter(person => person.status === 'available').length,
    waiting: people.filter(person => person.status === 'waiting').length,
    maybe: people.filter(person => person.status === 'maybe').length,
    unavailable: people.filter(person => person.status === 'unavailable').length,
    selectedWaiting: selectedIds === null ? null : people.filter(person => person.selected && person.status === 'waiting').map(person => person.name),
    selectedUnmatched: selectedIds?.filter(id => !unique.some(player => player.playerId === id)).length || 0,
    captainConfirmed: people.filter(person => person.status === 'available' && person.source === 'captain').length }
}

export type TeamAvailabilitySummary = ReturnType<typeof summarizeTeamAvailability>
