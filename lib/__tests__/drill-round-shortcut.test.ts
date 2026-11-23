import {describe,it,expect} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {drillRoundShortcut,newDrillPractice,type DrillPractice} from '../../mobile/src/drill-playbook'

const card=LEVEL_UP_CARDS.find(c=>c.id==='return-depth-lane')!
describe('Manual round handoff after rest',()=>{
 it('opens the first blank round and preserves a recorded zero and later results',()=>{
  const practice={...newDrillPractice(card)!,results:['0','','8']},before=structuredClone(practice)
  expect(drillRoundShortcut(card,practice)).toEqual({index:1,label:'Open round 2'})
  expect(practice).toEqual(before)
 })
 it('prioritizes an invalid count over an earlier blank',()=>{
  const practice={...newDrillPractice(card)!,results:['','11','8']},before=structuredClone(practice)
  expect(drillRoundShortcut(card,practice)).toEqual({index:1,label:'Review round 2'})
  expect(practice).toEqual(before)
 })
 it('uses the existing count validation without changing invalid raw values',()=>{
  for(const raw of ['-1','1.5','01',' 3','NaN']){
   const practice={...newDrillPractice(card)!,results:[raw,'','0']}
   expect(drillRoundShortcut(card,practice)).toEqual({index:0,label:'Review round 1'})
   expect(practice.results).toEqual([raw,'','0'])
  }
 })
 it('offers review when every round has a valid entry, including zero',()=>{
  const practice={...newDrillPractice(card,'pressure')!,results:['0','8','10']}
  expect(drillRoundShortcut(card,practice)).toEqual({index:0,label:'Review rounds'})
  expect(practice.results).toEqual(['0','8','10'])
 })
 it('uses the selected drill dose instead of assuming three rounds',()=>{
  const two=LEVEL_UP_CARDS.find(c=>c.id==='30-30-pressure-game')!,practice={...newDrillPractice(two,'pressure')!,results:['0','']}
  expect(drillRoundShortcut(two,practice)).toEqual({index:1,label:'Open round 2'})
  practice.results=['0','0'];expect(drillRoundShortcut(two,practice)).toEqual({index:0,label:'Review rounds'})
 })
 it('does not offer a shortcut for missing or mismatched practice',()=>{
  const practice=newDrillPractice(card)!
  for(const bad of [null,{...practice,cardId:'another-card'},{...practice,results:['']},{...practice,version:'missing' as DrillPractice['version']}])expect(drillRoundShortcut(card,bad)).toBeNull()
  const untracked=LEVEL_UP_CARDS.find(c=>!c.playbook)!;expect(drillRoundShortcut(untracked,practice)).toBeNull()
 })
})
