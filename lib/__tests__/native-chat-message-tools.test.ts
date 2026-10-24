import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {canManageNativePost,changeNativePost} from '../native-chat-message-tools'
const id='1959be10-4557-4a03-87bd-584ba14ff519'
const row={id,sender_user_id:'owner',body:'Original',message_kind:'message',metadata:null,edited_at:null,deleted_at:null,created_at:'2026-10-24',reply_to_message_id:null}
const edit={action:'edit_chat_post',messageId:id,body:'Updated',expectedBody:'Original',expectedEditedAt:''}
function database(reads:unknown[]=[{data:row,error:null}],updates:unknown[]=[{data:{...row,body:'Updated',edited_at:'saved'},error:null}]){
 const calls:{method:string;args:unknown[]}[]=[]
 const service={from:(table:string)=>{calls.push({method:'from',args:[table]});let updating=false
  const q:Record<string,unknown>={maybeSingle:vi.fn(async()=>updating?updates.shift():reads.shift())}
  for(const method of ['select','eq','is','filter','update'])q[method]=(...args:unknown[])=>{if(method==='update')updating=true;calls.push({method,args});return q}
  return q
 }} as unknown as SupabaseClient
 return {service,calls}
}
describe('native own-post edits and soft removal',()=>{
 it('guards owner, exact room, source body, version and metadata on the conditional update',async()=>{
  const db=database();expect(await changeNativePost(db.service,'owner','room',edit)).toMatchObject({ok:true,body:'Updated',removed:false,messageId:id,conversationId:'room'})
  for(const args of [['id',id],['sender_user_id','owner'],['conversation_id','room'],['body','Original']])expect(db.calls).toContainEqual({method:'eq',args})
  expect(db.calls).toContainEqual({method:'is',args:['edited_at',null]});expect(db.calls).toContainEqual({method:'is',args:['metadata',null]})
 })
 it('replays a saved edit without writing again and refuses a different stale edit',async()=>{
  const same=database([{data:{...row,body:'Updated',edited_at:'saved'}}]);expect(await changeNativePost(same.service,'owner','room',edit)).toMatchObject({ok:true});expect(same.calls.some(c=>c.method==='update')).toBe(false)
  const stale=database([{data:{...row,body:'Other edit',edited_at:'newer'}}]);expect(await changeNativePost(stale.service,'owner','room',edit)).toMatchObject({status:409});expect(stale.calls.some(c=>c.method==='update')).toBe(false)
 })
 it('rejects malformed inputs and formal workflow posts before mutation',async()=>{
  for(const patch of [{messageId:'invalid'},{body:''},{body:'x'.repeat(2401)},{expectedEditedAt:null}]){const db=database();expect(await changeNativePost(db.service,'owner','room',{...edit,...patch})).toMatchObject({status:400});expect(db.calls).toEqual([])}
  for(const data of [null,{...row,message_kind:'system'},{...row,metadata:{teamRoomCard:true}},{...row,metadata:{finalLineupAnnouncement:true}}]){const db=database([{data}]);expect(await changeNativePost(db.service,'owner','room',edit)).toMatchObject({status:404});expect(db.calls.some(c=>c.method==='update')).toBe(false)}
  expect(canManageNativePost({...row,metadata:{nativePhotoSha256:'hash',teamRoomAttachment:{path:'private'}}})).toBe(true)
 })
 it('soft-removes the owned photo without deleting storage or rewriting attachment metadata',async()=>{
  const photo={...row,metadata:{nativePhotoSha256:'hash',teamRoomAttachment:{path:'private'}}},removed={...photo,body:'Message removed.',deleted_at:'removed',edited_at:'removed'}
  const db=database([{data:photo}],[{data:removed}]);expect(await changeNativePost(db.service,'owner','room',{...edit,action:'remove_chat_post'})).toMatchObject({ok:true,removed:true})
  const patch=db.calls.find(c=>c.method==='update')!.args[0];expect(patch).toMatchObject({body:'Message removed.'});expect(patch).not.toHaveProperty('metadata');expect(db.calls.filter(c=>c.method==='from').every(c=>c.args[0]==='internal_messages')).toBe(true)
  const replay=database([{data:removed}]);expect(await changeNativePost(replay.service,'owner','room',{...edit,action:'remove_chat_post'})).toMatchObject({ok:true,removed:true});expect(replay.calls.some(c=>c.method==='update')).toBe(false)
 })
 it('checks a concurrent no-row update before confirming and fails closed on database errors',async()=>{
  const race=database([{data:row},{data:{...row,body:'Updated',edited_at:'other'}}],[{data:null}]);expect(await changeNativePost(race.service,'owner','room',edit)).toMatchObject({ok:true})
  const conflict=database([{data:row},{data:{...row,body:'Different'}}],[{data:null}]);expect(await changeNativePost(conflict.service,'owner','room',edit)).toMatchObject({status:409})
  expect(await changeNativePost(database([{error:{}}]).service,'owner','room',edit)).toMatchObject({status:503})
 })
})

it('edits or soft-removes plain announcements while protecting every workflow announcement',async()=>{
 const announcement={...row,message_kind:'announcement'},updated={...announcement,body:'Updated',edited_at:'saved'}
 const db=database([{data:announcement}],[{data:updated}]);expect(await changeNativePost(db.service,'owner','room',edit)).toMatchObject({ok:true,body:'Updated'});expect(db.calls).toContainEqual({method:'eq',args:['message_kind','announcement']})
 for(const metadata of [{teamRoomCard:{}},{finalLineupAnnouncement:true},{nativePublicationId:'x'},{teamRoomAttachment:{}}]){const blocked=database([{data:{...announcement,metadata}}]);expect(await changeNativePost(blocked.service,'owner','room',edit)).toMatchObject({status:404});expect(blocked.calls.some(c=>c.method==='update')).toBe(false)}
 const removal=database([{data:announcement}],[{data:{...announcement,body:'Message removed.',deleted_at:'saved',edited_at:'saved'}}]);expect(await changeNativePost(removal.service,'owner','room',{...edit,action:'remove_chat_post'})).toMatchObject({ok:true,removed:true})
})

it('keeps identity tags only while their exact text remains after an owned edit',async()=>{
 const tag={profileId:'11111111-1111-4111-8111-111111111111',label:'Alex Sample'},original={...row,body:'Ready @Alex Sample?',metadata:{nativeMentions:[tag]}}
 expect(canManageNativePost(original)).toBe(true)
 const removed=database([{data:original}],[{data:{...original,body:'Updated',edited_at:'saved',metadata:{nativeMentions:[]}}}])
 expect(await changeNativePost(removed.service,'owner','room',{...edit,expectedBody:original.body})).toMatchObject({ok:true})
 const update=removed.calls.find(call=>call.method==='update')!.args[0] as {metadata:unknown};expect(update.metadata).toEqual({nativeMentions:[]})
 const keep=database([{data:original}],[{data:{...original,body:'Thanks @Alex Sample!',edited_at:'saved'}}]);await changeNativePost(keep.service,'owner','room',{...edit,body:'Thanks @Alex Sample!',expectedBody:original.body})
 expect((keep.calls.find(call=>call.method==='update')!.args[0] as {metadata:unknown}).metadata).toEqual({nativeMentions:[tag]})
 expect(removed.calls).toContainEqual({method:'filter',args:['metadata','eq',JSON.stringify(original.metadata)]})
})
