import { buildEventDeskMatches } from './tournament-event-desk'
import type { TiqTournamentRecord } from './tiq-tournament-registry'

export function buildTournamentEventPass(division: TiqTournamentRecord, entrant: string) {
  if (!division.entrants.includes(entrant)) return null
  const matches = buildEventDeskMatches([division]).filter(match => match.sideA === entrant || match.sideB === entrant)
    .sort((a, b) => Number(a.matchId.split('-')[0].replace('r', '')) - Number(b.matchId.split('-')[0].replace('r', ''))
      || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  const upcoming = matches.filter(match => !match.completed)
  // An unassigned earlier round must not be skipped in favor of a later scheduled round.
  const next = upcoming[0] || null
  return { entrant, matches, next, completed: matches.filter(match => match.completed).length,
    opponent: next ? next.sideA === entrant ? next.sideB : next.sideA : '',
    finished: matches.length > 0 && upcoming.length === 0 && division.status === 'completed' }
}

export function buildEventDirectionsHref(event: TiqTournamentRecord) {
  const destination = event.eventDetails?.venueAddress || event.locationLabel
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : ''
}
