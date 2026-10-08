import { describe, it, expect } from 'vitest'
import { buildTournamentEventPass, buildEventDirectionsHref } from '../tournament-event-pass'
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
    expect(buildTournamentEventPass({...record,status:'completed'},'A')?.finished).toBe(true)
  })
  it('uses the event address and encodes special characters for directions', () => {
    expect(buildEventDirectionsHref({...division,eventDetails:{venueAddress:'910 Old Woodsmill Road, MO'}})).toContain('910%20Old%20Woodsmill')
    expect(buildEventDirectionsHref({...division,locationLabel:''})).toBe('')
  })
})
