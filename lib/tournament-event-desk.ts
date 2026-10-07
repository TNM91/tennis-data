import { buildTournamentPreview, type TiqTournamentRecord } from './tiq-tournament-registry'

export type EventDeskMatch = {
  key: string
  divisionId: string
  divisionName: string
  matchId: string
  label: string
  sideA: string
  sideB: string
  date: string
  time: string
  court: string
  completed: boolean
  assigned: boolean
}

export function normalizeEventCourt(court: string) {
  const value = court.trim().toLowerCase().replace(/^court\s+/, '').replace(/\s+/g, ' ')
  return /^\d+$/.test(value) ? String(Number(value)) : value
}

function calendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function isCompleteEventSlot(slot: { date: string; time: string; court: string }) {
  return calendarDate(slot.date) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.time) && Boolean(normalizeEventCourt(slot.court))
}

export function buildEventDeskMatches(divisions: TiqTournamentRecord[]): EventDeskMatch[] {
  return divisions.flatMap(division => division.entrants.length < 2 ? [] : buildTournamentPreview(division)
    .filter(match => match.sideA !== 'Bye' && match.sideB !== 'Bye')
    .map(match => {
      const slot = { date: match.schedule?.date || '', time: match.schedule?.time || '', court: match.schedule?.court || '' }
      return { key: `${division.id}:${match.id}`, divisionId: division.id, divisionName: division.name, matchId: match.id,
        label: match.label, sideA: match.sideA, sideB: match.sideB, ...slot,
        completed: Boolean(match.result?.winner), assigned: isCompleteEventSlot(slot) }
    }))
    .sort((a, b) => Number(b.assigned) - Number(a.assigned) || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      || a.court.localeCompare(b.court, undefined, { numeric: true }) || a.divisionName.localeCompare(b.divisionName))
}

export function findEventCourtOverlaps(matches: EventDeskMatch[], windowMinutes = 60) {
  const duration = [30, 45, 60, 90].includes(windowMinutes) ? windowMinutes : 60
  const assigned = matches.filter(match => match.assigned && !match.completed)
  const overlaps: Array<{ first: EventDeskMatch; second: EventDeskMatch }> = []
  for (let i = 0; i < assigned.length; i++) {
    for (let j = i + 1; j < assigned.length; j++) {
      const first = assigned[i], second = assigned[j]
      if (normalizeEventCourt(first.court) !== normalizeEventCourt(second.court)) continue
      const minute = (match: EventDeskMatch) => Date.parse(`${match.date}T${match.time}:00Z`) / 60000
      if (Math.abs(minute(first) - minute(second)) < duration) overlaps.push({ first, second })
    }
  }
  return overlaps
}

export function buildEventDivisionReadiness(division: TiqTournamentRecord, matches: EventDeskMatch[]) {
  const own = matches.filter(match => match.divisionId === division.id)
  const completed = own.filter(match => match.completed).length
  const assigned = own.filter(match => match.assigned).length
  const unscheduled = own.filter(match => !match.assigned && !match.completed).length
  const next = division.entrants.length < 2 ? { label: division.entrantType === 'teams' ? 'Add confirmed teams' : 'Add confirmed players', section: 'tournament-setup', kind: 'entrants' }
    : !own.length ? { label: 'Review division format', section: 'tournament-setup', kind: 'format' }
    : completed === own.length ? { label: 'Review awards', section: 'tournament-awards', kind: 'awards' }
    : unscheduled ? { label: 'Assign courts', section: 'tournament-scorebook', kind: 'schedule' }
    : { label: 'Enter scores', section: 'tournament-scorebook', kind: 'scores' }
  return { total: own.length, completed, assigned, unscheduled, ready: own.length > 0 && unscheduled === 0, next }
}