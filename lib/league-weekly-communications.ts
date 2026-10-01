import type { LeagueWeeklyCourt } from './league-weekly-format'

export type WeeklyCommunicationKind = 'reminder' | 'roster' | 'courts' | 'change'

export function isWeeklyCommunicationKind(value: unknown): value is WeeklyCommunicationKind {
  return value === 'reminder' || value === 'roster' || value === 'courts' || value === 'change'
}

export function getWeeklyCommunicationRecipients(input: {
  kind: WeeklyCommunicationKind
  entries: Array<{ player_name: string; created_by_user_id: string | null }>
  repliedNames: string[]
  roster: string[]
  assignments: LeagueWeeklyCourt[]
}) {
  const normalize = (name: string) => name.trim().toLowerCase()
  const replied = new Set(input.repliedNames.map(normalize))
  const roster = new Set(input.roster.map(normalize))
  const assigned = new Set(input.assignments.flatMap((court) => court.players.map(normalize)))
  return [...new Set(input.entries.filter((entry) => {
    if (!entry.created_by_user_id) return false
    const name = normalize(entry.player_name)
    if (input.kind === 'reminder') return !replied.has(name)
    if (input.kind === 'courts') return assigned.has(name)
    if (input.kind === 'roster') return roster.has(name)
    return true
  }).map((entry) => entry.created_by_user_id as string))]
}

export const WEEKLY_COMMUNICATION_LABELS: Record<WeeklyCommunicationKind, string> = {
  reminder: 'Reply reminder',
  roster: 'Confirmed roster',
  courts: 'Court assignments',
  change: 'Weekly plan update',
}
