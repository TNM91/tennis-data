import {it,expect} from 'vitest'
import {captainBriefNext} from '../captain-brief-next'
it.each([
 [{hasScope:false,hasLineup:false,responseRisks:2,hasLogistics:false},'scope'],
 [{hasScope:true,hasLineup:false,responseRisks:2,hasLogistics:false},'lineup'],
 [{hasScope:true,hasLineup:true,responseRisks:2,hasLogistics:false},'availability'],
 [{hasScope:true,hasLineup:true,responseRisks:0,hasLogistics:false},'logistics'],
 [{hasScope:true,hasLineup:true,responseRisks:0,hasLogistics:true},'share'],
] as const)('keeps the website planning prerequisites in order: %j', (input,kind)=>{expect(captainBriefNext(input).kind).toBe(kind)})
it('uses tennis-specific singular and plural response risk copy',()=>{expect(captainBriefNext({hasScope:true,hasLineup:true,responseRisks:1,hasLogistics:false}).detail).toContain('1 response risk still');expect(captainBriefNext({hasScope:true,hasLineup:true,responseRisks:2,hasLogistics:false}).detail).toContain('2 response risks still')})
