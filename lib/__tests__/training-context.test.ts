import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {cardTrainingWorkType,cardTrainingContext,cardTrainingContexts,trainingContextLabel,cardTrainingContextHint} from '../level-up/training-context'
import {buildLevelUpSessionPayload,mapLevelUpSessionRow} from '../level-up-sessions'
import {initialTrainingContext,trainingContexts,trainingSetup,trainingSelection,freezeTrainingSave} from '../../mobile/src/level-up-model'
import {parseTrainingSession,confirmsTrainingSave} from '../../mobile/src/level-up-data'
import {trainingHistoryHtml} from '../../mobile/src/level-up-view'

const card=LEVEL_UP_CARDS.find(card=>card.id==='return-1-conditioning')!
const owner='11111111-1111-4111-8111-111111111111',id='level-up-aaaaaaaa-aaaa-4aaa-8aaa-111111111111',date='2026-11-23T02:00:00.000Z'
const save=(context='partner')=>freezeTrainingSave(card,2,'Keep a balanced recovery.',context,'ready',120,id,date)
function roundTrip(context='partner'){
 const payload=buildLevelUpSessionPayload(save(context),owner)!
 return parseTrainingSession(mapLevelUpSessionRow({...payload,created_at:date}),owner)
}
it('finds partner conditioning under its actual setup while preserving physical work type',()=>{
 expect(cardTrainingWorkType(card)).toBe('physical');expect(cardTrainingContext(card)).toBe('partner');expect(initialTrainingContext(card)).toBe('partner');expect(trainingSetup(card)).toBe('partner')
 expect(trainingSelection(LEVEL_UP_CARDS,card.title,'court',10,'partner').map(card=>card.id)).toEqual([card.id]);expect(trainingSelection(LEVEL_UP_CARDS,card.title,'court',10,'solo')).toEqual([])
 expect(trainingContexts(card)).toEqual(['alone','partner']);expect(card.playbook).toBeUndefined()
 expect(cardTrainingContextHint(card)).toContain('Choose solo practice only if you have adapted it');expect(cardTrainingContextHint()).toBe('');expect(cardTrainingContextHint(card,'mental')).toBe('')
})
it('leaves ordinary physical and mental choices solo and keeps court choices unchanged',()=>{
 for(const id of ['jump-rope-intervals','wall-sit-leg-durability','three-step-reset']){const solo=LEVEL_UP_CARDS.find(card=>card.id===id)!;expect(cardTrainingContext(solo)).toBe('alone');expect(trainingContexts(solo)).toEqual(['alone'])}
 expect(cardTrainingContexts('court',card)).toEqual(['alone','partner','singles','doubles']);expect(cardTrainingContexts('physical')).toEqual(['alone']);expect(cardTrainingContexts('mental',card)).toEqual(['alone'])
 expect(()=>freezeTrainingSave(card,2,'','doubles','ready',120,id,date)).toThrow();expect(()=>freezeTrainingSave(card,2,'','coach','ready',120,id,date)).toThrow()
})
it('keeps every card default within its shared website and native choices',()=>{
 const before=JSON.stringify(LEVEL_UP_CARDS)
 for(const card of LEVEL_UP_CARDS){const type=cardTrainingWorkType(card),context=cardTrainingContext(card,type);expect(cardTrainingContexts(type,card),card.id).toContain(context);expect(trainingContexts(card),card.id).toContain(initialTrainingContext(card))}
 expect(JSON.stringify(LEVEL_UP_CARDS)).toBe(before)
})
it('round-trips a private partner conditioning session through the existing API payload and row mappers',()=>{
 const saved=save(),payload=buildLevelUpSessionPayload(saved,owner)!,row=roundTrip()
 expect(payload).toMatchObject({work_type:'physical',training_context:'partner',shared_with_coach:false,assignment_id:null,coach_user_id:null,student_link_id:null,rating:2});expect(payload.session_json.cardId).toBe(card.id)
 expect(row).toMatchObject({cardId:card.id,context:'partner',workType:'physical',note:saved.note,rating:2,sharedWithCoach:false});expect(confirmsTrainingSave(row,saved)).toBe(true)
 expect(trainingHistoryHtml([row])).toContain('With a partner');expect(trainingHistoryHtml([row])).not.toContain('Shared with coach')
})
it('preserves an older solo record and an explicit solo adaptation without changing its stored context',()=>{
 const row=roundTrip('alone'),before=JSON.stringify(row)
 expect(cardTrainingContext(card)).toBe('partner');expect(row.context).toBe('alone');expect(confirmsTrainingSave(row,save('alone'))).toBe(true);expect(confirmsTrainingSave(row,save())).toBe(false)
 expect(trainingHistoryHtml([row])).toContain('Solo');expect(JSON.stringify(row)).toBe(before)
})
it('refuses to confirm a save receipt that silently changes partner context',()=>{
 const row=roundTrip(),frozen=save();expect(Object.isFrozen(frozen)).toBe(true)
 expect(confirmsTrainingSave({...row,context:'alone'},frozen)).toBe(false);expect(confirmsTrainingSave({...row,workType:'court'},frozen)).toBe(false);expect(frozen.context).toBe('partner')
})
it('uses readable labels without changing the stable storage values or trusting unknown keys',()=>{
 expect(['alone','partner','singles','doubles','coach'].map(trainingContextLabel)).toEqual(['Solo','With a partner','Singles','Doubles','With a coach']);expect(trainingContextLabel('__proto__')).toBe('__proto__')
 expect(trainingHistoryHtml([{...roundTrip(),context:'<img src=x>'}])).toContain('&lt;img src=x&gt;')
})
