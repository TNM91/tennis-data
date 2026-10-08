import type { TiqTournamentRecord } from './tiq-tournament-registry'
import { normalizeEventCourt, type EventDeskMatch } from './tournament-event-desk'

/** Scheduled order only: a start time never implies a match is in progress. */
export function buildEventCourtQueue(matches: EventDeskMatch[], divisions: TiqTournamentRecord[], activeKeys: Set<string> = new Set()) {
  const playable = matches.filter(match => {
    const division = divisions.find(item => item.id === match.divisionId)
    return !match.completed && match.ready !== false && !!division
      && division.entrants.includes(match.sideA) && division.entrants.includes(match.sideB)
  })
  const scheduled = playable.filter(match => match.assigned).sort((a, b) =>
    Number(activeKeys.has(b.key)) - Number(activeKeys.has(a.key)) || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.key.localeCompare(b.key))
  const courts = new Map<string, EventDeskMatch[]>()
  for (const match of scheduled) {
    const key = normalizeEventCourt(match.court)
    courts.set(key, [...(courts.get(key) || []), match])
  }
  return {
    courts: [...courts.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([court, queue]) => ({ court, next: queue[0], remaining: queue.length })),
    unassigned: playable.filter(match => !match.assigned),
    awaitingPlayers: matches.filter(match => !match.completed && !playable.includes(match)).length,
  }
}
