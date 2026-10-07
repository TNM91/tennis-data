import type { TiqTournamentRecord } from './tiq-tournament-registry'

export function getTournamentEventRoots(records: TiqTournamentRecord[]) {
  // Keep an accessible division visible if its parent is unavailable.
  const ids = new Set(records.map(record => record.id))
  return records.filter(record => !record.eventId || !ids.has(record.eventId))
}

export function getTournamentEventDivisions(records: TiqTournamentRecord[], eventId: string) {
  return records.filter(record => record.eventId === eventId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export function getTournamentEventContext(records: TiqTournamentRecord[], record: TiqTournamentRecord | null) {
  if (!record) return { event: null, divisions: [] as TiqTournamentRecord[] }
  const event = record.isEvent ? record : records.find(item => item.id === record.eventId && item.isEvent) || null
  return { event, divisions: event ? getTournamentEventDivisions(records, event.id) : [] }
}

export function buildTournamentDivisionDraft(event: TiqTournamentRecord, name: string) {
  if (!event.isEvent || event.eventId) throw new Error('Choose an event before adding a division.')
  if (!name.trim()) throw new Error('Name the division first.')
  return {
    eventId: event.id, isEvent: false, eventTheme: event.eventTheme || 'classic' as const,
    registrationEmail: event.registrationEmail || '', createdByUserId: event.createdByUserId,
    eventDetails: event.eventDetails,
    clubId: event.clubId, clubGroupId: event.clubGroupId, resultMode: event.resultMode,
    name: name.trim(), format: event.format, entrantType: event.entrantType,
    status: 'draft' as const, startsOn: event.startsOn, locationLabel: event.locationLabel,
    directorNotes: '', entrants: [] as string[], isPublic: event.isPublic,
  }
}

export function getEventCourtConflicts(divisions: TiqTournamentRecord[]) {
  const slots = new Map<string, string[]>()
  for (const division of divisions) {
    for (const schedule of Object.values(division.schedule)) {
      if (!schedule.date || !schedule.time || !schedule.court) continue
      const key = `${schedule.date} ${schedule.time} · ${schedule.court.trim().toLowerCase()}`
      slots.set(key, [...(slots.get(key) || []), division.name])
    }
  }
  return [...slots].filter(([, names]) => names.length > 1).map(([slot, names]) => ({ slot, names }))
}
