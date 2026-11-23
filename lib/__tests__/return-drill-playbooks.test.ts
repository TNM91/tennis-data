import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {RETURN_DRILL_PLAYBOOKS} from '../level-up/return-drill-playbooks'
import {newDrillPractice,drillSessionNote,drillRoundTotals} from '../../mobile/src/drill-playbook'
import {readDrillEvidence} from '../../mobile/src/drill-progress'
import {initialTrainingContext,trainingSelection,freezeTrainingSave} from '../../mobile/src/level-up-model'
import {prepareGrowthPractice} from '../../mobile/src/tiq-practice-return'
import type {GrowthPlan} from '../tiq-growth'

const cases=[['return-step-in-game',10,8],['second-serve-attack-or-build',6,4]] as const
const get=(id:string)=>LEVEL_UP_CARDS.find(card=>card.id===id)!
const owner='11111111-1111-4111-8111-111111111111',uuid=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
it.each(cases)('logs both versions of %s with its own dose, private context and fresh repeat', (id,reps,clean)=>{
 const card=get(id),before=JSON.stringify(card)
 expect(trainingSelection(LEVEL_UP_CARDS,card.title,'court',10,'partner',true).map(card=>card.id)).toEqual([id]);expect(initialTrainingContext(card)).toBe('partner');expect(card.playbook!.players).toBe(2)
 expect(card.routine).toEqual(card.playbook!.versions[0].steps);expect(card.playbook!.versions[1].steps).not.toEqual(card.routine)
 for(const mode of card.playbook!.versions){
  expect(mode.rounds).toBe(3);expect(mode.reps).toBe(reps)
  const practice={...newDrillPractice(card,mode.id)!,results:['0','',String(clean)]},note=drillSessionNote(card,practice,'Keep the same serve pace.'),saved=freezeTrainingSave(card,2,note,'partner','ready',120,'level-up-'+uuid(4),'2026-11-23T01:30:00Z')
  expect(saved).toMatchObject({cardId:id,rating:2,context:'partner',sharedWithCoach:false});expect(saved.note).toContain(`R1 0/${reps}; R3 ${clean}/${reps}. Total ${clean}/${reps*2}.`);expect(saved).not.toHaveProperty('assignmentId')
  expect(readDrillEvidence(card,{...saved,playerUserId:owner})).toMatchObject({version:mode.id,clean,attempts:reps*2,recorded:2,percent:Math.round(clean/(reps*2)*100)})
  expect(()=>drillRoundTotals(card,{...practice,results:[String(reps+1),'','']})).toThrow(`Use a whole number from 0 to ${reps} for round 1.`)
  expect(newDrillPractice(card,mode.id)!.results).toEqual(['','',''])
 }
 expect(JSON.stringify(card)).toBe(before)
})
it('keeps six-return evidence distinct from a ten-return tally or a different count task',()=>{
 const card=get(cases[1][0]),practice={...newDrillPractice(card)!,results:['0','','4']},saved=freezeTrainingSave(card,2,drillSessionNote(card,practice,''),'partner','ready',120,'level-up-'+uuid(4),'2026-11-23T01:30:00Z')
 for(const note of [saved.note.replaceAll('/6','/10'),saved.note.replace('Balanced return choices','Planned return starts')])expect(readDrillEvidence(card,{...saved,playerUserId:owner,note})).toBeNull()
})
it('does not infer new round results or a coach completion from legacy return notes',()=>{
 for(const [id] of cases){const card=get(id),note='Earlier practice: 8 good returns and two points won.',saved=freezeTrainingSave(card,3,note,'partner','ready',120,'level-up-'+uuid(4),'2026-11-23T01:30:00Z');expect(readDrillEvidence(card,{...saved,playerUserId:owner})).toBeNull();expect(saved.note).toBe(note);expect(saved.sharedWithCoach).toBe(false);expect(saved).not.toHaveProperty('assignmentId')}
})
it('requires the exact planned return drill rather than crediting either new drill automatically',()=>{
 const plan:GrowthPlan={version:1,skill:'return',target:'Recover after returning',sessions:3,reviewDate:'2026-11-29',id:uuid(1),baseline:uuid(2),sourceAssignment:null,state:'active',logs:[],assessment:null,revision:uuid(3),createdAt:'2026-11-22T12:00:00Z',updatedAt:'2026-11-22T12:00:00Z'},before=JSON.stringify(plan)
 for(const [id] of cases){const card=get(id),saved=freezeTrainingSave(card,3,'Private return work.','partner','ready',120,'level-up-'+uuid(4),'2026-11-23T01:30:00Z');expect(prepareGrowthPractice(owner,plan.id,plan,{...saved,playerUserId:owner})).toEqual({state:'unavailable'})}
 expect(JSON.stringify(plan)).toBe(before)
})
it('retains card identities and adds both return tasks to the tracked library',()=>{
 expect(Object.keys(RETURN_DRILL_PLAYBOOKS).sort()).toEqual(cases.map(c=>c[0]).sort());expect(LEVEL_UP_CARDS.filter(card=>card.playbook)).toHaveLength(26)
 for(const [id] of cases){const card=get(id);expect(card.category).toBe('partner-drill');expect(card.equipment).toEqual(['partner']);expect(card.setting).toEqual(['court']);expect(card.qualityChecks).toHaveLength(3);expect(card.progression).toBe(card.playbook!.advance);expect(card.regression).toBe(card.playbook!.easier)}
})
