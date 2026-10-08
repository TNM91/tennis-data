import { describe, expect, it } from 'vitest'
import { currentCourtStatus, courtSlot, type EventCourtStatus } from '../tournament-event-court-status'
import { buildEventCourtQueue } from '../tournament-event-next-on-court'
import type { EventDeskMatch } from '../tournament-event-desk'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const match: EventDeskMatch = { key:'division:m1',divisionId:'division',divisionName:'4.0',matchId:'m1',label:'Round 1',sideA:'A',sideB:'B',date:'2026-10-17',time:'18:00',court:'1',assigned:true,completed:false,round:1 }
const row: EventCourtStatus = { event_id:'event',tournament_id:'division',match_id:'m1',side_a:'A',side_b:'B',slot:courtSlot(match),status:'called',updated_at:'version' }
describe('court call freshness',()=>{
 it('invalidates a call after its pairing, slot, division, or result changes',()=>{
  expect(currentCourtStatus(row,match)).toBe(true)
  for(const change of [{sideA:'C'},{time:'18:30'},{court:'2'},{divisionId:'other'},{completed:true}]) expect(currentCourtStatus(row,{...match,...change})).toBe(false)
 })
 it('keeps an active called match ahead of an earlier scheduled queue entry',()=>{
  const earlier={...match,key:'division:m2',matchId:'m2',time:'17:30'}
  const divisions=[{id:'division',entrants:['A','B']}] as TiqTournamentRecord[]
  expect(buildEventCourtQueue([earlier,match],divisions,new Set([match.key])).courts[0].next.matchId).toBe('m1')
  expect(buildEventCourtQueue([earlier,{...match,completed:true}],divisions,new Set([match.key])).courts[0].next.matchId).toBe('m2')
 })
})
