import {describe,it,expect} from 'vitest'
import {reconcileOfficialCourts, type CanonicalCourt} from '../usta-evidence-reconciliation'
const names=new Map([['a','Nathan Meinert'],['b','Kevin Chen']])
const row={championshipYear:2026,cells:['1011650669','2/18/2026','Kevin Chen','Nathan Meinert','6-7, 4-2, 1-0','#1 Singles','4.5']}
const court:CanonicalCourt={id:'one',match_date:'2026-01-25',match_type:'singles',score:'6-7 4-2 1-0',winner_side:'B',rating_eligible:true,match_players:[{player_id:'a',side:'A'},{player_id:'b',side:'B'}]}
describe('official USTA court reconciliation',()=>{
 it('exposes a rescheduled date and winner-first score without changing either',()=>{const result=reconcileOfficialCourts([row],[court],names,2026)[0];expect(result.status).toBe('date_difference');expect(result.matches[0]).toMatchObject({winnerMatches:true,scoreMatchesCourtSides:false,canonicalDate:'2026-01-25'});expect(court.match_date).toBe('2026-01-25')})
 it('distinguishes eligible duplicates from a retained excluded version',()=>{const same={...court,match_date:'2026-02-18'};expect(reconcileOfficialCourts([row],[same,{...same,id:'two',rating_eligible:false}],names,2026)[0].status).toBe('matched');expect(reconcileOfficialCourts([row],[same,{...same,id:'two'}],names,2026)[0].status).toBe('duplicate_eligible')})
 it('does not match merely by date or use team-level summary records',()=>{expect(reconcileOfficialCourts([row],[{...court,match_type:null}],names,2026)[0].status).toBe('missing');expect(reconcileOfficialCourts([row],[court],new Map([['a','Someone Else'],['b','Kevin Chen']]),2026)[0].status).toBe('missing')})
 it('keeps calendar date separate from championship year and rejects malformed rows',()=>{expect(reconcileOfficialCourts([{...row,championshipYear:2027}],[court],names,2026)[0].championshipYear).toBe(2027);expect(reconcileOfficialCourts([row],[court],names,2025)).toEqual([]);expect(()=>reconcileOfficialCourts([{...row,cells:row.cells.slice(0,6)}],[court],names,2026)).toThrow()})
})
