import { describe, expect, it } from 'vitest'
import { buildEventRunSheet, buildEventRunSheetHtml } from '../tournament-event-run-sheet'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const event = { id:'event',isEvent:true,name:'Pumpkin Playoffs',startsOn:'2026-10-17',eventDetails:{timeZoneLabel:'Central'},updatedAt:'' } as TiqTournamentRecord
const division = { id:'40',eventId:'event',name:'4.0',format:'single_elimination',entrantType:'teams',entrants:['A / B','C / D','E / F','G / H'],results:{},schedule:{'r1-m1':{date:'2026-10-17',time:'17:30',court:'1'}},contacts:{'A / B':{phone:'PRIVATE_PHONE'}},directorNotes:'PRIVATE_NOTE' } as unknown as TiqTournamentRecord
describe('event-day run sheet',()=>{
 it('groups assigned courts and retains unassigned playoff placeholders',()=>{
  const sheet=buildEventRunSheet(event,[division],[], 'Snapshot')
  expect(sheet.courts[0].name).toBe('Court 1')
  expect(sheet.assigned).toBe(1)
  expect(sheet.pending.length).toBeGreaterThan(0)
  expect(sheet.pending.some(row=>row.arrivalLabel==='Awaiting players')).toBe(true)
 })
 it('uses only this event and confirmed entrants for arrivals',()=>{
  const sheet=buildEventRunSheet(event,[division,{...division,id:'other',eventId:'other'}],[{tournament_id:'40',entrant_name:'A / B',checked_in:true},{tournament_id:'40',entrant_name:'WAITLIST',checked_in:true}], 'Snapshot')
  expect(sheet.confirmed).toBe(4)
  expect(sheet.checkedIn).toBe(1)
  expect(sheet.courts[0].matches[0].arrivalLabel).toBe('1/2 checked in')
 })
 it('flags overlaps across divisions on normalized court names',()=>{
  const sheet=buildEventRunSheet(event,[division,{...division,id:'45',name:'4.5',schedule:{'r1-m1':{date:'2026-10-17',time:'17:45',court:'Court 01',updatedAt:''}}}],[], 'Snapshot')
  expect(sheet.courts).toHaveLength(1)
  expect(sheet.overlaps).toBe(2)
 })
 it('escapes untrusted names and exports no private notes or contacts',()=>{
  const sheet=buildEventRunSheet({...event,name:'<script>alert("x")</script>'},[division],[], 'Snapshot')
  const html=buildEventRunSheetHtml(sheet)
  expect(html).not.toContain('<script>')
  expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('PRIVATE_PHONE')
  expect(html).not.toContain('PRIVATE_NOTE')
  expect(html).toContain('@media print')
 })
 it('handles an empty event without inventing a schedule or check-ins',()=>{
  const sheet=buildEventRunSheet(event,[],[], 'Snapshot')
  expect(sheet.total).toBe(0)
  expect(buildEventRunSheetHtml(sheet)).toContain('No matches yet.')
 })
})
