import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import type {LevelUpCard} from '../level-up/level-up-types'
import {trainingSelection,trainingSetup,trainingSetupLabel,initialTrainingContext,freezeTrainingSave,type TrainingFormat} from '../../mobile/src/level-up-model'

const guided=LEVEL_UP_CARDS.filter(card=>card.playbook)
it('finds every tracked drill once across the three practical setups',()=>{
 const groups=(['solo','partner','doubles'] as const).map(format=>trainingSelection(LEVEL_UP_CARDS,'','',Infinity,format,true))
 expect(groups.map(group=>group.length)).toEqual([6,9,5])
 expect(groups.flat().map(card=>card.id).sort()).toEqual(guided.map(card=>card.id).sort())
})
it('names the actual player count instead of implying all doubles drills need four',()=>{
 for(const [id,players,label] of [['serve-target-call',1,'Solo'],['serve-1-partner',2,'2 players'],['middle-ball-rule',3,'3 players'],['serve-location-call',4,'4 players']] as const){
  const card=guided.find(card=>card.id===id)!
  expect(card.playbook!.players).toBe(players);expect(trainingSetupLabel(card)).toBe(label)
 }
 const movement=guided.find(card=>card.id==='split-step-rhythm')!
 expect(trainingSetup(movement)).toBe('solo');expect(movement.playbook!.versions[1].requiresPartner).toBe(true)
})
it('keeps legacy cards discoverable using their existing context metadata',()=>{
 const base={...LEVEL_UP_CARDS[0],playbook:undefined,category:'court-drill',setting:['court'],equipment:[],tags:[]} as LevelUpCard
 expect(trainingSetup(base)).toBe('solo')
 expect(trainingSetup({...base,equipment:['partner']})).toBe('partner')
 expect(trainingSetup({...base,category:'partner-drill'})).toBe('partner')
 expect(trainingSetup({...base,tags:['doubles-communication']})).toBe('doubles')
 expect(trainingSetup({...base,category:'doubles-drill'})).toBe('doubles')
 expect(trainingSetupLabel({...base,category:'doubles-drill'})).toBe('Doubles group')
})
it('combines search, setting, inclusive time, setup and round tracking',()=>{
 const select=(minutes:number,setting='court')=>trainingSelection(LEVEL_UP_CARDS,'  RETURN DEPTH  ',setting,minutes,'partner',true)
 expect(select(10).map(card=>card.id)).toEqual(['return-depth-lane'])
 expect(select(15).map(card=>card.id)).toEqual(['return-depth-lane'])
 expect(select(8)).toEqual([]);expect(select(10,'home')).toEqual([])
 expect(trainingSelection(LEVEL_UP_CARDS,'return depth','court',10,'solo',true)).toEqual([])
})
it('makes tracking optional without hiding the rest of the library',()=>{
 expect(trainingSelection(LEVEL_UP_CARDS,'','',Infinity,'',true)).toEqual(guided)
 const plain=LEVEL_UP_CARDS.find(card=>!card.playbook)!
 expect(trainingSelection(LEVEL_UP_CARDS,plain.title,'').some(card=>card.id===plain.id)).toBe(true)
 expect(trainingSelection(LEVEL_UP_CARDS,plain.title,'',Infinity,'',true).some(card=>card.id===plain.id)).toBe(false)
})
it('preserves default behavior, original order and source cards',()=>{
 const before=JSON.stringify(LEVEL_UP_CARDS),legacy=trainingSelection(LEVEL_UP_CARDS,'serve','court',10)
 expect(legacy).toEqual(trainingSelection(LEVEL_UP_CARDS,'serve','court',10,'',false))
 const filtered=trainingSelection(LEVEL_UP_CARDS,'','',Infinity,'partner')
 expect(filtered).toEqual(LEVEL_UP_CARDS.filter(card=>trainingSetup(card)==='partner'))
 expect(trainingSelection(LEVEL_UP_CARDS,'','')).toEqual(LEVEL_UP_CARDS)
 expect(JSON.stringify(LEVEL_UP_CARDS)).toBe(before)
})
it('does not widen results for an unknown setup or an impossible combination',()=>{
 expect(trainingSelection(LEVEL_UP_CARDS,'','',Infinity,'unknown' as TrainingFormat)).toEqual([])
 expect(trainingSelection(LEVEL_UP_CARDS,'unmatched-drill-8192','court',5,'doubles',true)).toEqual([])
})
it('leaves private save context and self-rated proof separate from discovery metadata',()=>{
 for(const card of guided){
  const saved=freezeTrainingSave(card,2,'Private practice.',initialTrainingContext(card),'ready',120,'level-up-11111111-1111-4111-8111-111111111111','2026-11-22T12:00:00Z')
  expect(saved).toMatchObject({cardId:card.id,rating:2,sharedWithCoach:false,context:initialTrainingContext(card)})
  expect(saved).not.toHaveProperty('players');expect(saved).not.toHaveProperty('format');expect(Object.isFrozen(saved)).toBe(true)
 }
})
