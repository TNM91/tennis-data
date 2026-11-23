import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {tiqSkills} from '../tiq-assessment-skills'
import {GROUNDSTROKE_DRILL_PLAYBOOKS} from '../level-up/groundstroke-drill-playbooks'
import {trainingSelection,initialTrainingContext,freezeTrainingSave} from '../../mobile/src/level-up-model'
import {newDrillPractice,drillSessionNote,drillRoundTotals} from '../../mobile/src/drill-playbook'
import {prepareGrowthPractice} from '../../mobile/src/tiq-practice-return'
import type {GrowthPlan} from '../tiq-growth'

const cases=[['basket-forehand-crosscourt',1,3],['basket-backhand-crosscourt',1,3],['crosscourt-consistency',2,3],['defense-neutral-attack-rally',2,2],['return-plus-one-recover',2,2],['approach-volley-close',2,2]] as const
it.each(cases)('finds %s with the correct setup and saves its own rounds privately',(id,players,rounds)=>{
 const card=LEVEL_UP_CARDS.find(card=>card.id===id)!,before=JSON.stringify(card),practice=newDrillPractice(card,'pressure')!,context=players===1?'alone':'partner'
 expect(trainingSelection(LEVEL_UP_CARDS,card.title,'court',10,players===1?'solo':'partner',true).map(row=>row.id)).toContain(id)
 expect(initialTrainingContext(card)).toBe(context)
 expect(card.playbook!.players).toBe(players);expect(card.playbook!.versions.every(mode=>mode.rounds===rounds&&mode.reps===10)).toBe(true)
 expect(card.routine).toEqual(card.playbook!.versions[0].steps);expect(card.playbook!.versions[1].steps).not.toEqual(card.routine)
 expect(practice.results).toEqual(Array(rounds).fill(''))
 practice.results[0]='0';practice.results[rounds-1]='8'
 expect(drillRoundTotals(card,practice)).toMatchObject({recorded:2,clean:8,attempts:20})
 const note=drillSessionNote(card,practice,'Recover ready.'),saved=freezeTrainingSave(card,2,note,context,'ready',120,'level-up-11111111-1111-4111-8111-111111111111','2026-11-22T18:00:00Z')
 expect(saved).toMatchObject({cardId:id,rating:2,context,sharedWithCoach:false})
 expect(saved.note).toContain('R1 0/10; R'+rounds+' 8/10. Total 8/20.');expect(saved).not.toHaveProperty('assignmentId');expect(Object.isFrozen(saved)).toBe(true)
 expect(newDrillPractice(card)!.results).toEqual(Array(rounds).fill(''));expect(JSON.stringify(card)).toBe(before)
})
it('keeps the six groundstroke playbooks alongside the expanded tracked library',()=>{
 const all=LEVEL_UP_CARDS.filter(card=>card.playbook)
 expect(all).toHaveLength(24);expect(new Set(all.map(card=>card.id)).size).toBe(24)
 expect(Object.keys(GROUNDSTROKE_DRILL_PLAYBOOKS).sort()).toEqual(cases.map(([id])=>id).sort())
 for(const skill of tiqSkills){expect(all.some(card=>card.id===skill.drill.id)).toBe(true);expect(cases.map(([id])=>id)).not.toContain(skill.drill.id)}
})
it('does not credit a related groundstroke drill as the exact practice linked to an assessment plan',()=>{
 const owner='11111111-1111-4111-8111-111111111111',id=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
 const plan:GrowthPlan={version:1,skill:'return',target:'Recover after the return',sessions:3,reviewDate:'2026-11-29',id:id(1),baseline:id(2),sourceAssignment:null,state:'active',logs:[],assessment:null,revision:id(3),createdAt:'2026-11-20T12:00:00Z',updatedAt:'2026-11-20T12:00:00Z'},before=JSON.stringify(plan)
 for(const [cardId] of cases){const card=LEVEL_UP_CARDS.find(card=>card.id===cardId)!,save=freezeTrainingSave(card,3,'Private practice.',initialTrainingContext(card),'ready',120,'level-up-'+id(4),'2026-11-22T18:00:00Z')
  expect(prepareGrowthPractice(owner,plan.id,plan,{...save,playerUserId:owner})).toEqual({state:'unavailable'})
 }
 expect(JSON.stringify(plan)).toBe(before)
})
