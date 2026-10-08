import type { TiqTournamentRecord } from './tiq-tournament-registry'
import { normalizeTournamentEventDetails, formatTournamentEventFee } from './tournament-event-presentation'

export function buildEventPublicationReview(event: TiqTournamentRecord, divisions: TiqTournamentRecord[]) {
  const details = normalizeTournamentEventDetails(event.eventDetails)
  const date = new Date(`${event.startsOn}T12:00:00Z`)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(event.startsOn) && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === event.startsOn
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.registrationEmail || '')
  const fee = details.feePerPlayer !== undefined || details.feePerTeam !== undefined
  const children = divisions.filter(row => row.eventId === event.id)
  const items = [
    { label:'Event name', ready:!!event.name.trim(), detail:event.name || 'Add an event name.' },
    { label:'Date and start time', ready:validDate && !!details.startsAt && !!details.timeZone, detail:validDate && details.startsAt && details.timeZone ? `${event.startsOn} · ${details.startsAt} · ${details.timeZone}` : 'Add a valid date, start time, and time zone.' },
    { label:'Venue', ready:!!details.venueName && !!details.venueAddress, detail:details.venueName && details.venueAddress ? `${details.venueName} · ${details.venueAddress}` : 'Add the venue name and full address.' },
    { label:'Divisions', ready:children.length>0 && children.every(row => !!row.name.trim()) && new Set(children.map(row => row.name.trim().toLowerCase())).size===children.length, detail:children.length ? children.map(row => row.name).join(' · ') : 'Add at least one division.' },
    { label:'Entry fee', ready:fee, detail:fee ? [details.feePerPlayer!==undefined ? `${formatTournamentEventFee(details.feePerPlayer,details.currency)} per player` : '',details.feePerTeam!==undefined ? `${formatTournamentEventFee(details.feePerTeam,details.currency)} per team` : ''].filter(Boolean).join(' · ') : 'Add the entry fee, including 0 for a free event.' },
    { label:'Signup deadline', ready:!!details.registrationClosesOn && validDate && details.registrationClosesOn<=event.startsOn, detail:details.registrationClosesOn || 'Add a signup deadline on or before the event.' },
    { label:'Director and signup contact', ready:!!details.directorName && email, detail:details.directorName && email ? `${details.directorName} · ${event.registrationEmail}` : 'Add the director name and a valid signup email.' },
    { label:'Format', ready:!!details.formatSummary, detail:details.formatSummary || 'Explain how group play and playoffs work.' },
  ]
  return { items, ready:event.isEvent===true && event.status!=='completed' && items.every(item=>item.ready), children }
}
export function eventPublicationVersion(event: TiqTournamentRecord, divisions: TiqTournamentRecord[]) {
  const snapshot = (row: TiqTournamentRecord) => ({ id:row.id,updatedAt:row.updatedAt,name:row.name,format:row.format,
    entrantType:row.entrantType,status:row.status,startsOn:row.startsOn,locationLabel:row.locationLabel,directorNotes:row.directorNotes,
    eventId:row.eventId,isEvent:row.isEvent,eventTheme:row.eventTheme,registrationEmail:row.registrationEmail,isPublic:row.isPublic,
    eventDetails:normalizeTournamentEventDetails(row.eventDetails),entrants:row.entrants,results:row.results,schedule:row.schedule })
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value==='object'
    ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)])) : value
  return JSON.stringify(stable([snapshot(event),...divisions.filter(row=>row.eventId===event.id).sort((a,b)=>a.id.localeCompare(b.id)).map(snapshot)]))
}
