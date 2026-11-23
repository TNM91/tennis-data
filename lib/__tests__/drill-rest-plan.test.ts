import {describe,it,expect} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {drillRestGuidance,newDrillPractice,type DrillPractice} from '../../mobile/src/drill-playbook'
import {restDurations,RestCountdown} from '../../mobile/src/drill-rest'

const card=(id:string)=>LEVEL_UP_CARDS.find(value=>value.id===id)!
describe('Drill-specific rest guidance',()=>{
 it('provides an available default for both versions of every tracked drill without changing counts',()=>{
  const tracked=LEVEL_UP_CARDS.filter(value=>value.playbook);expect(tracked).toHaveLength(26)
  for(const value of tracked)for(const version of value.playbook!.versions){
   const practice=newDrillPractice(value,version.id)!,before=structuredClone(practice),plan=drillRestGuidance(value,practice)
   expect(plan).not.toBeNull();expect(restDurations(plan)).toContain(plan!.seconds);expect(plan!.guidance).toContain('between rounds.');expect(practice).toEqual(before)
  }
 })
 it('starts a range at its longer end and still permits a longer recovery',()=>{
  const value=card('return-depth-lane'),plan=drillRestGuidance(value,newDrillPractice(value,'pressure'))!
  expect(plan).toMatchObject({seconds:45,guidance:'30–45 seconds between rounds.'})
  expect(restDurations(plan)).toEqual([30,45,60,90,120])
 })
 it('uses the existing fixed rest for wall and point-planning practice',()=>{
  const wall=card('wall-rally-rhythm'),point=card('30-30-pressure-game')
  expect(drillRestGuidance(wall,newDrillPractice(wall))?.seconds).toBe(30)
  expect(drillRestGuidance(point,newDrillPractice(point,'pressure'))?.seconds).toBe(45)
 })
 it('keeps the conditioning minimum for both versions while offering longer rests',()=>{
  for(const id of ['serve-1-conditioning','return-1-conditioning'])for(const version of ['control','pressure'] as const){
   const value=card(id),plan=drillRestGuidance(value,newDrillPractice(value,version))!
   expect(plan).toEqual({seconds:60,minimumSeconds:60,guidance:'At least 60 seconds between rounds.'})
   expect(restDurations(plan)).toEqual([60,90,120])
  }
 })
 it('does not reuse another card or a stale practice version',()=>{
  const value=card('return-depth-lane'),practice=newDrillPractice(value)!
  for(const bad of [null,{...practice,cardId:'wall-rally-rhythm'},{...practice,version:'missing' as DrillPractice['version']}])expect(drillRestGuidance(value,bad)).toBeNull()
 })
 it('keeps a generic manual countdown available when a drill has no rest plan',()=>{
  const value=card('return-depth-lane'),legacy={...value,playbook:{...value.playbook!,rest:undefined}}
  expect(drillRestGuidance(legacy,newDrillPractice(legacy))).toBeNull()
  expect(new RestCountdown().snapshot()).toEqual({duration:60,remaining:60,phase:'idle'})
  expect(restDurations()).toEqual([30,45,60,90,120])
 })
})
