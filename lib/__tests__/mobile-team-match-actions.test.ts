import {nativeMatchTargetIsCurrent} from '../native-match-target'
import {describe,it,expect,vi} from 'vitest'
import {TeamMatchActions,matchActionsHtml} from '../../mobile/src/team-match-actions'
import {parseTeamData} from '../../mobile/src/team-room-data'
import {ChatActionError,postTeamChat} from '../../mobile/src/team-chat-send'
import type {SupabaseClient} from '@supabase/supabase-js'
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'}
const action={action:'respond' as const,messageId:'card',response:'yes' as const}
const raw=()=>({ok:true,teams:[scope],room:{...scope,id:'room',activeCardId:'card',members:[{id:'owner',name:'Alex',playerName:'Alex'}],finalLineupReview:{announcementMessageId:'announcement',currentUserRequired:true,currentUserSeen:false},messages:[{id:'card',card:{cardType:'projected_lineup',state:'active',lineupVersion:2,acknowledged:false,finalLineup:{id:'lineup'},lineup:[{label:'D1',players:['Alex','<Jordan>']}],arrivalCheckIns:[{profileId:'owner',status:'on_my_way'}]},response:'maybe'}]}})
describe('native match-day coordination',()=>{
 it('renders availability, lineup review, final acknowledgment and assigned-player arrival without injecting names',()=>{
  const room=parseTeamData(raw()).room!,markup=matchActionsHtml(room,'owner')
  for(const label of ['Maybe','I’ve reviewed this lineup','I’ve seen the final lineup','On my way','Running late'])expect(markup).toContain(label)
  expect(markup).not.toContain('<Jordan>');expect(matchActionsHtml(room,'unassigned')).not.toContain('data-match-arrival')
  room.activeCard!.card!.state='archived';expect(matchActionsHtml(room,'owner')).not.toContain('data-match-response')
 })
 it('locks the desired choice across an ambiguous response and prevents concurrent submits',async()=>{
  let finish!:(value:unknown)=>void
  const send=vi.fn().mockRejectedValueOnce(new ChatActionError('unknown',true)).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const state=new TeamMatchActions(send);expect(await state.submit(action)).toBe(false);const retry=state.submit({action:'respond',messageId:'other',response:'no'});expect(await state.submit()).toBe(false);expect(send.mock.calls[1][0]).toEqual(action);finish({});expect(await retry).toBe(true);expect(state.pending).toBeNull()
 })
 it('discards late confirmations and clears definitive failures',async()=>{
  const rejected=new TeamMatchActions(async()=>{throw new ChatActionError('changed',false)});expect(await rejected.submit(action)).toBe(false);expect(rejected.pending).toBeNull()
  let finish!:(value:unknown)=>void;const state=new TeamMatchActions(()=>new Promise(resolve=>{finish=resolve}));const saving=state.submit(action);state.dispose();finish({});expect(await saving).toBe(false);expect(state.notice).toBe('')
 })
 it('pins native match transport and requires exact response/version/status confirmations',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient
  const send=vi.fn().mockResolvedValue({status:200,data:{ok:true,response:'yes'}})
  await postTeamChat(client,'owner',()=>true,scope,action,send);expect(send.mock.calls[0][0].data.nativeClient).toBe(true)
  for(const [request,data] of [[{action:'respond',messageId:'card',response:'yes'},{response:'no'}],[{action:'acknowledge_lineup',messageId:'card',lineupVersion:2},{lineupVersion:3}],[{action:'set_arrival_status',messageId:'card',arrivalStatus:'here'},{checkIn:{status:'running_late'}}],[{action:'ack_final_lineup',messageId:'final'},{seen:false}]] as const){send.mockResolvedValueOnce({status:200,data:{ok:true,...data}});await expect(postTeamChat(client,'owner',()=>true,scope,request,send)).rejects.toThrow()}
  send.mockResolvedValueOnce({status:409,data:{ok:false}});await expect(postTeamChat(client,'owner',()=>true,scope,action,send)).rejects.toMatchObject({uncertain:false})
 })
})

describe('native active-match write boundary',()=>{
 it('rejects stale, missing and completed targets before legacy action handlers run',()=>{
  for(const action of ['respond','acknowledge_lineup','set_arrival_status']){
   expect(nativeMatchTargetIsCurrent(action,'current','current',{})).toBe(true)
   for(const id of ['older','',null,42])expect(nativeMatchTargetIsCurrent(action,id,'current',{})).toBe(false)
   expect(nativeMatchTargetIsCurrent(action,'current','current',{matchCompletedAt:'done'})).toBe(false)
  }
  expect(nativeMatchTargetIsCurrent('ack_final_lineup','announcement','current',{})).toBe(true)
  expect(nativeMatchTargetIsCurrent('ack_final_lineup','announcement','current',{matchCompletedAt:'done'})).toBe(false)
 })
})


describe('native replacement experience',()=>{
 const token='a'.repeat(64)
 it('shows the court and status, escapes names and only exposes server-authorized reply buttons',()=>{
  const value=raw();Object.assign(value.room.messages[0].card,{nativeReplacement:{courtLabel:'D1',outgoingPlayerName:'<Taylor>',replacementPlayerName:'Alex',afterPlayers:['Alex','<Jordan>'],response:'',token,canRespond:true}})
  let room=parseTeamData(value).room!,markup=matchActionsHtml(room,'owner');expect(markup).toContain('Accept replacement');expect(markup).toContain('&lt;Taylor&gt;');expect(markup).not.toContain('<Jordan>')
  Object.assign(value.room.messages[0].card,{nativeReplacement:{courtLabel:'D1',replacementPlayerName:'Alex',afterPlayers:['Alex'],response:'accepted',token,canRespond:true}})
  room=parseTeamData(value).room!;markup=matchActionsHtml(room,'owner');expect(markup).toContain('Replacement accepted.');expect(markup).not.toContain('data-replacement-response')
  Object.assign(value.room.messages[0].card,{nativeReplacement:{courtLabel:'D1',replacementPlayerName:'Alex',afterPlayers:[],token:'bad',canRespond:true}});expect(parseTeamData(value).room!.activeCard!.card!.replacement).toBeNull()
 })
 it('sends the frozen request token and requires the same card, response and token as proof',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient
  const action={action:'respond_lineup_change' as const,messageId:'card',response:'accepted' as const,replacementToken:token}
  const send=vi.fn().mockResolvedValue({status:200,data:{ok:true,response:'accepted',messageId:'card',replacementToken:token}})
  await postTeamChat(client,'owner',()=>true,scope,action,send);expect(send.mock.calls[0][0].data).toMatchObject({...action,nativeClient:true,...scope})
  for(const data of [{response:'declined',messageId:'card',replacementToken:token},{response:'accepted',messageId:'other',replacementToken:token},{response:'accepted',messageId:'card',replacementToken:'old'}]){send.mockResolvedValueOnce({status:200,data:{ok:true,...data}});await expect(postTeamChat(client,'owner',()=>true,scope,action,send)).rejects.toMatchObject({uncertain:true})}
  send.mockResolvedValueOnce({status:409,data:{ok:false}});await expect(postTeamChat(client,'owner',()=>true,scope,action,send)).rejects.toMatchObject({uncertain:false})
 })
})
