import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {NET_DRILL_PLAYBOOKS} from '../level-up/net-drill-playbooks'
import {newDrillPractice,drillSessionNote} from '../../mobile/src/drill-playbook'
import {readDrillEvidence} from '../../mobile/src/drill-progress'
import {trainingSelection,initialTrainingContext,freezeTrainingSave} from '../../mobile/src/level-up-model'
import {prepareGrowthPractice} from '../../mobile/src/tiq-practice-return'
import type {GrowthPlan} from '../tiq-growth'

const ids=['volley-punch-target','reaction-volley-wall'] as const
it.each(ids)('discovers and privately records both versions of %s without inventing unfinished rounds',id=>{
 const card=LEVEL_UP_CARDS.find(card=>card.id===id)!,solo=id==='reaction-volley-wall',context=solo?'alone':'partner',before=JSON.stringify(card)
 expect(trainingSelection(LEVEL_UP_CARDS,card.title,solo?'wall':'court',10,solo?'solo':'partner',true).map(card=>card.id)).toEqual([id])
 expect(initialTrainingContext(card)).toBe(context);expect(card.playbook!.players).toBe(solo?1:2)
 expect(card.routine).toEqual(card.playbook!.versions[0].steps);expect(card.playbook!.versions[1].steps).not.toEqual(card.routine)
 for(const mode of card.playbook!.versions){
  expect(mode.rounds).toBe(3);expect(mode.reps).toBe(10);expect(mode.steps).toHaveLength(4)
  const practice=newDrillPractice(card,mode.id)!;practice.results=['0','','8']
  const note=drillSessionNote(card,practice,'Keep the reset.'),saved=freezeTrainingSave(card,2,note,context,'ready',120,'level-up-11111111-1111-4111-8111-111111111111','2026-11-22T23:30:00Z')
  expect(saved).toMatchObject({cardId:id,rating:2,context,sharedWithCoach:false});expect(saved.note).toContain('R1 0/10; R3 8/10. Total 8/20.');expect(saved).not.toHaveProperty('assignmentId')
  expect(readDrillEvidence(card,{...saved,playerUserId:'11111111-1111-4111-8111-111111111111'})).toMatchObject({version:mode.id,clean:8,attempts:20,recorded:2,percent:40})
  expect(newDrillPractice(card,mode.id)!.results).toEqual(['','',''])
 }
 expect(JSON.stringify(card)).toBe(before)
})
it('adds exactly two net playbooks without replacing earlier tracked drills or card identities',()=>{
 expect(Object.keys(NET_DRILL_PLAYBOOKS).sort()).toEqual([...ids].sort())
 const cards=LEVEL_UP_CARDS.filter(card=>card.playbook);expect(cards).toHaveLength(20);expect(new Set(cards.map(card=>card.id)).size).toBe(20)
 for(const id of ['serve-target-call','return-depth-lane','wall-rally-rhythm','split-step-rhythm','volley-ready-split','30-30-pressure-game','serve-1-partner','serve-location-call','doubles-return-first-move','middle-ball-rule','switch-call-drill','poach-timing-shadow','basket-forehand-crosscourt','basket-backhand-crosscourt','crosscourt-consistency','defense-neutral-attack-rally','return-plus-one-recover','approach-volley-close'])expect(cards.some(card=>card.id===id)).toBe(true)
})
it('leaves older free-form notes unchanged rather than inferring counts after the upgrade',()=>{
 for(const id of ids){
  const card=LEVEL_UP_CARDS.find(card=>card.id===id)!,note='Old session: 8/10 felt better. Four blocks completed.',saved=freezeTrainingSave(card,3,note,initialTrainingContext(card),'ready',120,'level-up-11111111-1111-4111-8111-111111111111','2026-11-22T23:30:00Z'),row={...saved,playerUserId:'11111111-1111-4111-8111-111111111111'}
  expect(readDrillEvidence(card,row)).toBeNull();expect(row.note).toBe(note)
 }
})
it('does not treat a related volley drill as the exact TiQ practice assigned to a plan',()=>{
 const owner='11111111-1111-4111-8111-111111111111',uuid=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
 const plan:GrowthPlan={version:1,skill:'net',target:'Be ready for the first volley',sessions:3,reviewDate:'2026-11-29',id:uuid(1),baseline:uuid(2),sourceAssignment:null,state:'active',logs:[],assessment:null,revision:uuid(3),createdAt:'2026-11-22T12:00:00Z',updatedAt:'2026-11-22T12:00:00Z'},before=JSON.stringify(plan)
 for(const id of ids){const card=LEVEL_UP_CARDS.find(card=>card.id===id)!,save=freezeTrainingSave(card,3,'Private volley practice.',initialTrainingContext(card),'ready',120,'level-up-'+uuid(4),'2026-11-22T23:30:00Z');expect(prepareGrowthPractice(owner,plan.id,plan,{...save,playerUserId:owner})).toEqual({state:'unavailable'})}
 expect(JSON.stringify(plan)).toBe(before)
})
it('uses controlled wall resets and balanced net recovery without treating rebounds as reaction scores',()=>{
 const wall=LEVEL_UP_CARDS.find(card=>card.id===ids[1])!,net=LEVEL_UP_CARDS.find(card=>card.id===ids[0])!
 expect(wall.playbook!.countRule).toContain('Starting shots and deliberate reset catches are not attempts')
 expect(wall.playbook!.advance).toContain('not a measured reaction-time test');expect(wall.commonMiss!.fix).toContain('do not move closer to force faster contacts')
 expect(wall.safetyNote).toContain('never chase an unsafe rebound');expect(wall.playbook!.versions[1].steps.join(' ')).toContain('without erasing the tally')
 expect(net.playbook!.versions[0].steps.join(' ')).toContain('do not take an automatic step toward the net');expect(net.playbook!.countRule).toContain('Repeat a feed')
})
