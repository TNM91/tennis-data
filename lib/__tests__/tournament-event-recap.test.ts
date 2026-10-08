import { describe, expect, it } from 'vitest'
import { buildEventDivisionRecap, buildTournamentEventRecap } from '../tournament-event-recap'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const event: TiqTournamentRecord = { id:'pumpkin', isEvent:true, name:'Pumpkin Playoffs',format:'group_playoffs',entrantType:'teams',status:'draft',startsOn:'2026-10-17',locationLabel:'Woodsmill',directorNotes:'Private note',entrants:[],results:{},schedule:{},contacts:{},entrantPlayerIds:{},isPublic:false,createdAt:'',updatedAt:'' }
const division: TiqTournamentRecord = { ...event,id:'40',eventId:'pumpkin',isEvent:false,name:"Men’s 4.0 Doubles",entrants:['A','B'] }
describe('event recap',()=>{
  it('requires a posted final and preserves its pairing and score order',()=>{
    expect(buildEventDivisionRecap(division).champion).toBe('')
    const row=buildEventDivisionRecap({...division,results:{'r1-m1':{winner:'B',sideA:'A',sideB:'B',score:'4-6',updatedAt:''}}})
    expect(row).toMatchObject({champion:'B',runnerUp:'A',score:'4-6',detail:'A vs B',posted:1,total:1})
  })
  it('rejects stale final participants and finals without resolved prior rounds',()=>{
    const d={...division,format:'single_elimination' as const,entrants:['A','B','C','D']}
    expect(buildEventDivisionRecap({...d,results:{'r2-m1':{winner:'A',score:'6-4',updatedAt:''}}}).champion).toBe('')
    expect(buildEventDivisionRecap({...d,results:{'r1-m1':{winner:'A',score:'6-4',updatedAt:''},'r1-m2':{winner:'B',score:'6-4',updatedAt:''},'r2-m1':{winner:'A',sideA:'A',sideB:'C',score:'6-4',updatedAt:''}}}).champion).toBe('')
  })
  it('reports unique round-robin winners only after every match, and leaves ties for review',()=>{
    const d={...division,format:'round_robin' as const,entrants:['A','B','C']}
    const results={'r1-m2':{winner:'B',score:'6-4',updatedAt:''},'r2-m1':{winner:'A',score:'6-4',updatedAt:''},'r3-m1':{winner:'A',score:'6-4',updatedAt:''}}
    expect(buildEventDivisionRecap({...d,results:{'r1-m2':results['r1-m2']}}).champion).toBe('')
    expect(buildEventDivisionRecap({...d,results}).champion).toBe('A')
    expect(buildEventDivisionRecap({...d,results:{...results,'r3-m1':{winner:'B',score:'6-4',updatedAt:''}}}).champion).toBe('B')
    const tied=buildEventDivisionRecap({...d,results:{...results,'r1-m2':{winner:'C',score:'6-4',updatedAt:''},'r3-m1':{winner:'B',score:'6-4',updatedAt:''}}})
    expect(tied.champion).toBe('');expect(tied.detail).toBe('Tied standings · director review')
  })
  it('keeps pending divisions and omits private notes, contacts, and private links',()=>{
    const completed={...division,results:{'r1-m1':{winner:'B',sideA:'A',sideB:'B',score:'4-6',updatedAt:''}}}
    const recap=buildTournamentEventRecap(event,[completed,{...division,id:'45',name:'4.5'}, {...completed,id:'other',eventId:'other'}])
    expect(recap.confirmed).toBe(1);expect(recap.rows).toHaveLength(2)
    expect(recap.message).toContain('Champion: B');expect(recap.message).toContain('Title still to be decided')
    expect(recap.message).toContain('A vs B — 4-6');expect(recap.message).not.toContain('Private note');expect(recap.message).not.toContain('https://')
    expect(buildTournamentEventRecap({...event,isPublic:true},[completed]).message).toContain('https://www.tenaceiq.com/tournaments/pumpkin')
  })
})
