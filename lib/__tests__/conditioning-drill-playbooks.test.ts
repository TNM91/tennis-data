import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {CONDITIONING_DRILL_PLAYBOOKS} from '../level-up/conditioning-drill-playbooks'
import {newDrillPractice,drillSessionNote,DrillResultError} from '../../mobile/src/drill-playbook'
import {readDrillEvidence} from '../../mobile/src/drill-progress'
import {initialTrainingContext,trainingSelection,trainingWorkType,freezeTrainingSave} from '../../mobile/src/level-up-model'
import {prepareGrowthPractice} from '../../mobile/src/tiq-practice-return'
import type {GrowthPlan} from '../tiq-growth'

const cases=[['serve-1-conditioning','alone','solo','serve'],['return-1-conditioning','partner','partner','return']] as const
const get=(id:string)=>LEVEL_UP_CARDS.find(card=>card.id===id)!
const owner='11111111-1111-4111-8111-111111111111',uuid=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0'),date='2026-11-23T02:30:00Z'
it.each(cases)('keeps %s physical and privately logs six-attempt versions with the correct setup',(id,context,format)=>{
 const card=get(id),before=JSON.stringify(card)
 expect(trainingWorkType(card)).toBe('physical');expect(initialTrainingContext(card)).toBe(context);expect(trainingSelection(LEVEL_UP_CARDS,card.title,'court',10,format,true).map(card=>card.id)).toEqual([id]);expect(card.category).toBe('conditioning')
 for(const mode of card.playbook!.versions){
  expect(mode.rounds).toBe(3);expect(mode.reps).toBe(6)
  const practice={...newDrillPractice(card,mode.id)!,results:['0','','4']},note=drillSessionNote(card,practice,'Keep the rest.','',context),saved=freezeTrainingSave(card,2,note,context,'ready',120,'level-up-'+uuid(4),date)
  expect(saved).toMatchObject({cardId:id,workType:'physical',context,rating:2,sharedWithCoach:false});expect(saved.note).toContain('R1 0/6; R3 4/6. Total 4/12.');expect(saved).not.toHaveProperty('assignmentId')
  expect(readDrillEvidence(card,{...saved,playerUserId:owner})).toMatchObject({version:mode.id,clean:4,attempts:12,recorded:2,percent:33});expect(newDrillPractice(card,mode.id)!.results).toEqual(['','',''])
  expect(()=>drillSessionNote(card,{...practice,results:['7','','']},'','',context)).toThrow('Use a whole number from 0 to 6 for round 1.')
 }
 expect(JSON.stringify(card)).toBe(before)
})
it('preserves raw counts and the private note when a partner version is mistakenly logged as solo',()=>{
 for(const id of ['return-1-conditioning','split-step-rhythm']){const card=get(id),practice={...newDrillPractice(card,'pressure')!,results:['0','','']},before=structuredClone(practice);let error:unknown
  try{drillSessionNote(card,practice,'Keep this note.','','alone')}catch(caught){error=caught}
  expect(error).toBeInstanceOf(DrillResultError);expect(error).toMatchObject({field:'context'});expect((error as Error).message).toContain('clear the rounds to save a solo note');expect(practice).toEqual(before)
  expect(drillSessionNote(card,practice,'Keep this note.','','partner')).toContain('Keep this note.')
 }
})
it('allows a solo return adaptation with blank rounds and never infers counts from its note',()=>{
 const card=get('return-1-conditioning'),note=drillSessionNote(card,newDrillPractice(card),'Solo shadow recovery.','','alone'),saved=freezeTrainingSave(card,3,note,'alone','ready',120,'level-up-'+uuid(4),date)
 expect(note).toBe('Solo shadow recovery.');expect(readDrillEvidence(card,{...saved,playerUserId:owner})).toBeNull();expect(saved.context).toBe('alone')
})
it.each(cases)('does not credit %s as the exact drill in a related TiQ plan',(id,context,_format,skill)=>{
 const plan:GrowthPlan={version:1,skill,target:'Recover in balance',sessions:3,reviewDate:'2026-11-29',id:uuid(1),baseline:uuid(2),sourceAssignment:null,state:'active',logs:[],assessment:null,revision:uuid(3),createdAt:date,updatedAt:date},before=JSON.stringify(plan),card=get(id),saved=freezeTrainingSave(card,3,'Physical practice.',context,'ready',120,'level-up-'+uuid(4),date)
 expect(prepareGrowthPractice(owner,plan.id,plan,{...saved,playerUserId:owner})).toEqual({state:'unavailable'});expect(JSON.stringify(plan)).toBe(before)
})
it('keeps older conditioning notes unchanged and rejects a different task or attempt dose as evidence',()=>{
 for(const [id,context] of cases){const card=get(id),note='Earlier conditioning: three blocks and 8 good starts.',saved=freezeTrainingSave(card,3,note,context,'ready',120,'level-up-'+uuid(4),date);expect(readDrillEvidence(card,{...saved,playerUserId:owner})).toBeNull();expect(saved.note).toBe(note)
  const evidence=drillSessionNote(card,{...newDrillPractice(card)!,results:['0','','4']},'','',context)
  for(const changed of [evidence.replaceAll('/6','/10'),evidence.replace(card.playbook!.countLabel,'Other task')])expect(readDrillEvidence(card,{...saved,playerUserId:owner,note:changed})).toBeNull()
 }
})
it('retains card identities, original setups and separate coaching for all tracked practice',()=>{
 expect(Object.keys(CONDITIONING_DRILL_PLAYBOOKS).sort()).toEqual(cases.map(row=>row[0]).sort());expect(LEVEL_UP_CARDS.filter(card=>card.playbook)).toHaveLength(26)
 expect(get(cases[0][0]).equipment).toEqual(['basket']);expect(get(cases[1][0]).equipment).toEqual(['partner'])
 for(const [id] of cases){const card=get(id);expect(card.routine).toEqual(card.playbook!.versions[0].steps);expect(card.qualityChecks).toHaveLength(3);expect(card.progression).toBe(card.playbook!.advance);expect(card.regression).toBe(card.playbook!.easier)}
})
