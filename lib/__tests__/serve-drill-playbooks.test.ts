import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS,LEVEL_UP_MODULES} from '../level-up/level-up-cards'
import {SERVE_DRILL_PLAYBOOKS} from '../level-up/serve-drill-playbooks'
import {newDrillPractice,drillSessionNote} from '../../mobile/src/drill-playbook'
import {readDrillEvidence} from '../../mobile/src/drill-progress'
import {initialTrainingContext,trainingSelection,freezeTrainingSave} from '../../mobile/src/level-up-model'
import {trainingModuleHtml} from '../../mobile/src/level-up-view'
import {prepareGrowthPractice} from '../../mobile/src/tiq-practice-return'
import type {GrowthPlan} from '../tiq-growth'

const ids=['serve-target-ladder','second-serve-routine-reps'] as const
const get=(id:string)=>LEVEL_UP_CARDS.find(card=>card.id===id)!
const owner='11111111-1111-4111-8111-111111111111',uuid=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
it.each(ids)('privately logs both versions of %s with separate zero and unfinished rounds',id=>{
 const card=get(id),before=JSON.stringify(card)
 expect(trainingSelection(LEVEL_UP_CARDS,card.title,'court',10,'solo',true).map(card=>card.id)).toEqual([id]);expect(initialTrainingContext(card)).toBe('alone');expect(card.playbook!.players).toBe(1)
 expect(card.routine).toEqual(card.playbook!.versions[0].steps);expect(card.playbook!.versions[1].steps).not.toEqual(card.routine)
 for(const mode of card.playbook!.versions){
  expect(mode.rounds).toBe(3);expect(mode.reps).toBe(10);expect(mode.steps).toHaveLength(4)
  const practice={...newDrillPractice(card,mode.id)!,results:['0','','8']},note=drillSessionNote(card,practice,'Keep the same reset.'),saved=freezeTrainingSave(card,2,note,'alone','ready',120,'level-up-'+uuid(4),'2026-11-23T00:10:00Z')
  expect(saved).toMatchObject({cardId:id,rating:2,context:'alone',sharedWithCoach:false});expect(saved.note).toContain('R1 0/10; R3 8/10. Total 8/20.');expect(saved).not.toHaveProperty('assignmentId')
  expect(readDrillEvidence(card,{...saved,playerUserId:owner})).toMatchObject({version:mode.id,clean:8,attempts:20,recorded:2,percent:40});expect(newDrillPractice(card,mode.id)!.results).toEqual(['','',''])
 }
 expect(JSON.stringify(card)).toBe(before)
})
it('keeps routine success separate from serve placement and rejects a different metric in saved evidence',()=>{
 const ladder=get(ids[0]),routine=get(ids[1])
 expect(ladder.playbook!.countRule).toContain('A fault, wrong zone or missing call is a miss')
 expect(routine.playbook!.countRule).toContain('A net or out fault can still count');expect(routine.playbook!.countRule).toContain('a foot fault or missed routine step cannot');expect(routine.playbook!.countRule).toContain('not serve accuracy')
 const saved=freezeTrainingSave(routine,2,drillSessionNote(routine,{...newDrillPractice(routine)!,results:['8','','']},''),'alone','ready',120,'level-up-'+uuid(4),'2026-11-23T00:10:00Z')
 expect(readDrillEvidence(routine,{...saved,playerUserId:owner,note:saved.note.replace('Routine reps kept','Target serves')})).toBeNull()
 expect(ladder.playbook!.versions[1].steps.join(' ')).toContain('ten attempts in all');expect(ladder.playbook!.countRule).toContain('Repeat service lets')
})
it('does not infer round counts from earlier free-form serve or shadow notes',()=>{
 for(const id of ids){const card=get(id),note='Old practice: shadowed 8 reps and felt better.',saved=freezeTrainingSave(card,3,note,'alone','ready',120,'level-up-'+uuid(4),'2026-11-23T00:10:00Z');expect(readDrillEvidence(card,{...saved,playerUserId:owner})).toBeNull();expect(saved.note).toBe(note)}
})
it('keeps these drills separate from the exact serve practice in a TiQ plan',()=>{
 const plan:GrowthPlan={version:1,skill:'serve',target:'Call the serve target',sessions:3,reviewDate:'2026-11-29',id:uuid(1),baseline:uuid(2),sourceAssignment:null,state:'active',logs:[],assessment:null,revision:uuid(3),createdAt:'2026-11-22T12:00:00Z',updatedAt:'2026-11-22T12:00:00Z'},before=JSON.stringify(plan)
 for(const id of ids){const card=get(id),saved=freezeTrainingSave(card,3,'Private serve work.','alone','ready',120,'level-up-'+uuid(4),'2026-11-23T00:10:00Z');expect(prepareGrowthPractice(owner,plan.id,plan,{...saved,playerUserId:owner})).toEqual({state:'unavailable'})}
 expect(JSON.stringify(plan)).toBe(before)
})
it('retains the serve practice block order and advances only its confirmed completion set',()=>{
 expect(Object.keys(SERVE_DRILL_PLAYBOOKS).sort()).toEqual([...ids].sort());expect(LEVEL_UP_CARDS.filter(card=>card.playbook)).toHaveLength(24)
 const practiceBlock=LEVEL_UP_MODULES.find(block=>block.id==='serve-pressure-reset')!,completed=new Set<string>()
 expect(practiceBlock.cardIds).toEqual([...ids,'double-fault-reset']);expect(get('double-fault-reset').playbook).toBeUndefined()
 expect(trainingModuleHtml(practiceBlock,completed)).toContain('0 of 3 drills saved');expect(completed.size).toBe(0)
 completed.add(ids[0]);const html=trainingModuleHtml(practiceBlock,completed);expect(html).toContain('1 of 3 drills saved');expect(html).toContain('data-card="second-serve-routine-reps" data-module-next');expect(html).not.toContain('Block complete')
})
