import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {tiqSkills} from '../tiq-assessment-skills'
import {trainingSelection,initialTrainingContext,freezeTrainingSave} from '../../mobile/src/level-up-model'
import {newDrillPractice,drillSessionNote,drillRoundTotals} from '../../mobile/src/drill-playbook'
import {prepareGrowthPractice} from '../../mobile/src/tiq-practice-return'
import type {GrowthPlan} from '../tiq-growth'
const ids=['serve-1-partner','serve-location-call','doubles-return-first-move','middle-ball-rule','switch-call-drill','poach-timing-shadow']
it.each(ids)('keeps %s discoverable with its original context and a private two-round result',id=>{
 const card=LEVEL_UP_CARDS.find(card=>card.id===id)!,practice=newDrillPractice(card,'pressure')!
 expect(trainingSelection(LEVEL_UP_CARDS,card.title,'court').filter(row=>row.id===id)).toHaveLength(1)
 expect(initialTrainingContext(card)).toBe(id==='serve-1-partner'?'partner':'doubles')
 expect(practice.results).toEqual(['','']);expect(card.playbook!.versions.every(mode=>mode.requiresPartner!==true)).toBe(true)
 expect(card.routine).toEqual(card.playbook!.versions[0].steps)
 practice.results=['0','8'];expect(drillRoundTotals(card,practice)).toMatchObject({recorded:2,clean:8,attempts:20})
 const note=drillSessionNote(card,practice,'One clear call.'),saved=freezeTrainingSave(card,2,note,initialTrainingContext(card),'ready',120,'level-up-11111111-1111-4111-8111-111111111111','2026-11-22T12:00:00Z')
 expect(saved).toMatchObject({cardId:id,rating:2,sharedWithCoach:false});expect(saved.note).toContain('R1 0/10; R2 8/10. Total 8/20.');expect(saved).not.toHaveProperty('assignmentId');expect(Object.isFrozen(saved)).toBe(true)
 expect(()=>drillSessionNote(card,{...practice,results:['0','8','9']},'')).toThrow('Review the current drill')
 expect(newDrillPractice(card)!.results).toEqual(['',''])
})
it('extends the library to twelve playbooks without replacing the six assessment-linked drills',()=>{
 const all=LEVEL_UP_CARDS.filter(card=>card.playbook)
 expect(all).toHaveLength(12);expect(new Set(all.map(card=>card.id)).size).toBe(12)
 for(const skill of tiqSkills){expect(all.some(card=>card.id===skill.drill.id)).toBe(true);expect(ids).not.toContain(skill.drill.id)}
})
it('does not count a doubles or plus-one session as a completed assessment-linked practice plan',()=>{
 const owner='11111111-1111-4111-8111-111111111111',id=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
 const plan:GrowthPlan={version:1,skill:'serve',target:'Serve to a clear target',sessions:3,reviewDate:'2026-11-29',id:id(1),baseline:id(2),sourceAssignment:null,state:'active',logs:[],assessment:null,revision:id(3),createdAt:'2026-11-20T12:00:00Z',updatedAt:'2026-11-20T12:00:00Z'},before=JSON.stringify(plan)
 for(const cardId of ids){const card=LEVEL_UP_CARDS.find(card=>card.id===cardId)!,save=freezeTrainingSave(card,3,'Pair moved together.',initialTrainingContext(card),'ready',120,'level-up-'+id(4),'2026-11-22T12:00:00Z')
  expect(prepareGrowthPractice(owner,plan.id,plan,{...save,playerUserId:owner})).toEqual({state:'unavailable'})
 }
 expect(JSON.stringify(plan)).toBe(before)
})
