import { describe, it, expect } from 'vitest'
import { buildTournamentEventPass, buildEventDirectionsHref } from '../tournament-event-pass'
import { buildTournamentGroupChampionship } from '../tiq-tournament-registry'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'

const division: TiqTournamentRecord = { id:'40', eventId:'pumpkin', name:'Men’s 4.0 Doubles', format:'round_robin',
  entrantType:'teams', status:'scheduled', startsOn:'2026-10-17', locationLabel:'Woodsmill', directorNotes:'',
  entrants:['A','B','C','D'], results:{}, schedule:{}, contacts:{}, entrantPlayerIds:{}, isPublic:true, createdAt:'', updatedAt:'' }
describe('player event pass', () => {
  it('rejects unknown or pending entrants', () => { expect(buildTournamentEventPass(division,'Someone else')).toBeNull() })
  it('keeps an earlier unassigned round ahead of a scheduled later round', () => {
    const pass = buildTournamentEventPass({ ...division, schedule:{'r3-m1':{date:'2026-10-17',time:'19:30',court:'4',updatedAt:''}} },'A')!
    expect(pass.next?.matchId).toBe('r1-m1'); expect(pass.next?.assigned).toBe(false)
  })
  it('advances after a result and exposes the assigned opponent, court, and time', () => {
    const record = { ...division, results:{'r1-m1':{winner:'A',score:'6-4',updatedAt:''}},
      schedule:{'r2-m1':{date:'2026-10-17',time:'18:30',court:'2',updatedAt:''}} }
    const pass = buildTournamentEventPass(record,'A')!
    expect(pass.completed).toBe(1); expect(pass.next).toMatchObject({ matchId:'r2-m1', assigned:true, time:'18:30',court:'2' })
    expect(pass.opponent).not.toBe('A')
  })
  it('does not declare the event finished before the organizer closes it', () => {
    const record = { ...division, entrants:['A','B'], results:{'r1-m1':{winner:'A',score:'6-4',updatedAt:''}} }
    expect(buildTournamentEventPass(record,'A')?.finished).toBe(false)
    expect(buildTournamentEventPass(record,'A')?.runComplete).toBe(true)
    expect(buildTournamentEventPass({...record,status:'completed'},'A')?.finished).toBe(true)
  })
  it('shows only the chosen entrant’s posted results and preserves score order', () => {
    const record = {...division, results:{'r1-m1':{winner:'A',score:'6-4',updatedAt:''},'r1-m2':{winner:'B',score:'7-5',updatedAt:''}}}
    const pass = buildTournamentEventPass(record,'A')!
    expect(pass.results).toHaveLength(1)
    expect(pass.results[0]).toMatchObject({score:'6-4',won:true,winner:'A'})
    expect(pass.upcoming).toHaveLength(2)
  })
  it('explains waiting for a group qualifier after the entrant finishes their group matches', () => {
    const record = {...division,format:'group_playoffs' as const,entrants:['A','B','C','D','E','F']}
    const group = buildTournamentGroupChampionship(record).groups.find(item=>item.entrants.includes('A'))!
    const results = Object.fromEntries(group.matches.filter(match=>[match.sideA,match.sideB].includes('A')).map(match=>[match.id,{winner:'A',sideA:match.sideA,sideB:match.sideB,score:match.sideA==='A'?'6-4':'4-6',updatedAt:''}]))
    const pass = buildTournamentEventPass({...record,results},'A')!
    expect(pass.next).toBeNull()
    expect(pass.awaitingGroupResults).toBe(true)
    expect(pass.runComplete).toBe(false)
  })
  it('recognizes a bracket champion and an eliminated entrant without inventing a next match', () => {
    const record = {...division,format:'single_elimination' as const,entrants:['A','B'],results:{'r1-m1':{winner:'A',score:'6-4',updatedAt:''}}}
    expect(buildTournamentEventPass(record,'A')).toMatchObject({champion:true,next:null})
    expect(buildTournamentEventPass(record,'B')).toMatchObject({runComplete:true,next:null})
  })
  it('uses the event address and encodes special characters for directions', () => {
    expect(buildEventDirectionsHref({...division,eventDetails:{venueAddress:'910 Old Woodsmill Road, MO'}})).toContain('910%20Old%20Woodsmill')
    expect(buildEventDirectionsHref({...division,locationLabel:''})).toBe('')
  })
})
