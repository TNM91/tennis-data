import type { EventDeskMatch } from './tournament-event-desk'
export type CourtStatus = 'queued' | 'called' | 'on_court'
export type EventCourtStatus = { event_id: string; tournament_id: string; match_id: string; status: CourtStatus; side_a: string; side_b: string; slot: string; updated_at: string }
export function courtSlot(match: EventDeskMatch) { return `${match.date}|${match.time}|${match.court}` }
export function currentCourtStatus(row: EventCourtStatus, match: EventDeskMatch) {
 return !match.completed && row.tournament_id === match.divisionId && row.match_id === match.matchId && row.side_a === match.sideA && row.side_b === match.sideB && row.slot === courtSlot(match)
}
