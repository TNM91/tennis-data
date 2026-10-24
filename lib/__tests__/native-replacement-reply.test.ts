import {describe,it,expect} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {replacementReplyIsCurrent,replacementReplyToken,replacementReplyReplayed,saveReplacementCard} from '../native-replacement-reply'
const card=()=>({cardType:'projected_lineup',lineup:[{label:'D1',players:['Alex','Jordan']}],lineupChangeNotice:{pending:false,response:'',replacementPlayerName:'Alex',courtLabel:'D1',afterPlayers:['Alex','Jordan']}})
describe('replacement reply boundary',()=>{
 it('binds the linked replacement to the displayed plan, rejecting stale, completed, pending and answered requests',()=>{
  const metadata=card(),token=replacementReplyToken('card',metadata),input={messageId:'card',metadata,token,linkedPlayerName:'  ALEX  '}
  expect(replacementReplyIsCurrent(input)).toBe(true)
  const stale={...metadata,lineup:[{label:'D1',players:['Taylor','Jordan']}]};expect(replacementReplyIsCurrent({...input,metadata:stale,token:replacementReplyToken('card',stale)})).toBe(false)
  for(const patch of [{token:''},{messageId:'other'},{linkedPlayerName:'Jordan'},{linkedPlayerName:''},{metadata:{...metadata,matchCompletedAt:'done'}},{metadata:{...metadata,lineup:[]}},{metadata:{...metadata,lineupChangeNotice:{...metadata.lineupChangeNotice,pending:true}}},{metadata:{...metadata,lineupChangeNotice:{...metadata.lineupChangeNotice,response:'accepted'}}}])expect(replacementReplyIsCurrent({...input,...patch})).toBe(false)
 })
 it('cannot restore a stale card, even when the player started before the captain changed it',async()=>{
  let stored:Record<string,unknown>=card();const seen=structuredClone(stored);let expected='',room='',id='';let patch:Record<string,unknown>={}
  const q={update:(p:Record<string,unknown>)=>{patch=p;return q},eq:(k:string,v:string)=>{if(k==='id')id=v;if(k==='conversation_id')room=v;return q},is:()=>q,filter:(_k:string,_op:string,v:string)=>{expected=v;return q},select:()=>q,maybeSingle:async()=>{if(expected!==JSON.stringify(stored)||room!=='room'||id!=='card')return {data:null,error:null};stored=patch.metadata as Record<string,unknown>;return {data:{id},error:null}}}
  const service={from:()=>q} as unknown as SupabaseClient
  stored={...stored,lineup:[{label:'D1',players:['Taylor','Jordan']}]}
  expect(await saveReplacementCard(service,'room','card',seen,{...seen,finalLineup:'obsolete'},'now')).toBe('changed')
  expect(stored).not.toHaveProperty('finalLineup')
  const current=structuredClone(stored);expect(await saveReplacementCard(service,'room','card',current,{...current,answered:true},'now')).toBe('saved')
  expect(await saveReplacementCard(service,'room','card',current,{...current,answered:false},'now')).toBe('changed');expect(stored.answered).toBe(true)
 })
 it('keeps ambiguous database errors distinct from a definitive stale-card conflict',async()=>{
  const q={update:()=>q,eq:()=>q,is:()=>q,filter:()=>q,select:()=>q,maybeSingle:async()=>({data:null,error:{code:'connection_lost'}})}
  expect(await saveReplacementCard({from:()=>q} as unknown as SupabaseClient,'room','card',card(),card(),'now')).toBe('unconfirmed')
 })
})

describe('interrupted replacement reply recovery',()=>{
 it('recognizes only the same actor, choice, token and court version, never a newer captain plan',()=>{
  const metadata={...card(),lineupVersion:2,lineupChangeNotice:{...card().lineupChangeNotice,response:'accepted',responderProfileId:'player'},nativeReplacementReply:{token:'original',actor:'player',response:'accepted',lineupVersion:2,lineup:card().lineup}}
  expect(replacementReplyReplayed(metadata,'player','accepted','original')).toBe(true)
  for(const patch of [{lineupVersion:3},{lineup:[]},{lineupChangeNotice:{...metadata.lineupChangeNotice,pending:true}}])expect(replacementReplyReplayed({...metadata,...patch},'player','accepted','original')).toBe(false)
  for(const [actor,response,token] of [['other','accepted','original'],['player','declined','original'],['player','accepted','other']])expect(replacementReplyReplayed(metadata,actor,response,token)).toBe(false)
 })
})
