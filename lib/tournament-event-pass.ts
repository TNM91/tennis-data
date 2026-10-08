import { buildEventDeskMatches } from './tournament-event-desk'
import type { TiqTournamentRecord } from './tiq-tournament-registry'
import { buildTournamentGroupChampionship } from './tiq-tournament-registry'

export function buildTournamentEventPass(division: TiqTournamentRecord, entrant: string) {
  if (!division.entrants.includes(entrant)) return null
  const matches = buildEventDeskMatches([division]).filter(match => match.sideA === entrant || match.sideB === entrant)
    .sort((a, b) => a.round - b.round
      || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  const upcoming = matches.filter(match => !match.completed)
  // An unassigned earlier round must not be skipped in favor of a later scheduled round.
  const next = upcoming[0] || null
  const championship=division.format==='group_playoffs' ? buildTournamentGroupChampionship(division):null
  const group=championship?.groups.find(item=>item.entrants.includes(entrant))
  const champion=championship?.champion===entrant
  const runComplete=Boolean(!next && !champion && (group?.qualifier && group.qualifier!==entrant
    || championship?.playoffs.some(match=>[match.sideA,match.sideB].includes(entrant) && match.result && match.result.winner!==entrant && match.sideA!=='Bye' && match.sideB!=='Bye')))
  return { entrant, matches, next, completed: matches.filter(match => match.completed).length,
    opponent: next ? next.sideA === entrant ? next.sideB : next.sideA : '',
    champion, runComplete,
    finished: matches.length > 0 && upcoming.length === 0 && division.status === 'completed' }
}

export function buildEventDirectionsHref(event: TiqTournamentRecord) {
  const destination = event.eventDetails?.venueAddress || event.locationLabel
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : ''
}
