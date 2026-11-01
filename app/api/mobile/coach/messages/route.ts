import {coachConversationId} from '@/lib/native-coach-chat-unread'
import {markTeamChatRead} from '@/lib/team-chat-read'
import {verifiedAccount,accountClient,readAccountJson} from '@/lib/mobile-account-auth'
import {supabaseKey} from '@/lib/supabase-public-config'
import {coachId,coachRecord} from '@/lib/native-coach-contract'
import {after} from 'next/server'
import {sendNativeCoachChatPush} from '@/lib/native-coach-chat-push'
export const runtime='nodejs'
export const maxDuration=30
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})

async function handle(request:Request,write:boolean){
 const account=await verifiedAccount(request);if(!account)return json({ok:false},401)
 const owner=account.user.id,client=accountClient(supabaseKey,account.token)
 try{
  const params=new URL(request.url).searchParams
  if([...params.keys()].some(k=>!['student','message'].includes(k)||params.getAll(k).length!==1))return json({ok:false},400)
  if(!params.has('student')&&!write){const links=await client.from('coach_player_links').select('id,coach_user_id,player_user_id,player_name,status').or('coach_user_id.eq.'+owner+',player_user_id.eq.'+owner).neq('status','paused').order('updated_at',{ascending:false}).limit(101);if(links.error)throw Error();return json({ok:true,owner,connections:(links.data??[]).slice(0,100).filter(r=>r.player_user_id&&(r.coach_user_id===owner||r.player_user_id===owner)).map(r=>({id:r.id,name:r.coach_user_id===owner?r.player_name:'Your coach',role:r.coach_user_id===owner?'coach':'player'})),more:(links.data?.length??0)>100})}
  const selected=coachId(params.get('student')),result=await client.from('coach_player_links').select('id,coach_user_id,player_user_id,player_name,status').eq('id',selected).maybeSingle(),link=result.data
  if(result.error)throw Error()
  if(!link||!link.player_user_id||link.status==='paused'||![link.coach_user_id,link.player_user_id].includes(owner))return json({ok:false},404)
  const id=coachConversationId(selected)
  if(write){
   const body=coachRecord(await readAccountJson(request,12000));if(Object.keys(body).some(k=>!['id','body'].includes(k))||typeof body.body!=='string'||!body.body.trim()||body.body.length>4000)return json({ok:false},400)
   const messageId=coachId(body.id);if(!/^[0-9a-f-]{36}$/i.test(messageId))return json({ok:false},400)
   const existing=await client.from('internal_conversations').select('id,created_by_user_id,conversation_type,related_entity_type,related_entity_id').eq('id',id).maybeSingle();if(existing.error)throw Error()
   if(!existing.data){const created=await client.from('internal_conversations').insert({id,conversation_type:'direct',subject:'Coach & player',status:'open',created_by_user_id:owner,related_entity_type:'coach_student',related_entity_id:selected,metadata:{source:'native-coach'}});if(created.error)throw Error()}
   else if(existing.data.conversation_type!=='direct'||existing.data.related_entity_type!=='coach_student'||existing.data.related_entity_id!==selected)throw Error()
   // The creator can safely finish an interrupted initial participant insert.
   if(!existing.data||existing.data.created_by_user_id===owner){const members=await client.from('internal_conversation_participants').upsert([{conversation_id:id,profile_id:link.coach_user_id,participant_role:'member'},{conversation_id:id,profile_id:link.player_user_id,participant_role:'member'}],{onConflict:'conversation_id,profile_id',ignoreDuplicates:true});if(members.error)throw Error()}
   const saved=await client.from('internal_messages').insert({id:messageId,conversation_id:id,sender_user_id:owner,body:body.body.trim(),message_kind:'message'})
   if(saved.error&&saved.error.code!=='23505')throw Error()
   // A duplicate/recovery POST never schedules a second alert. Delivery failure
   // must not change the outcome of an already saved message.
   if(!saved.error){const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(key)try{after(async()=>{await sendNativeCoachChatPush(accountClient(key),{student:selected,conversationId:id,actorId:owner,recipientId:link.coach_user_id===owner?link.player_user_id:link.coach_user_id,messageId})})}catch{console.warn('native_coach_alert_schedule_unavailable')}}
   const checked=await client.from('internal_messages').select('id,body,sender_user_id,conversation_id').eq('id',messageId).eq('conversation_id',id).eq('sender_user_id',owner).maybeSingle()
   if(checked.error||checked.data?.body!==body.body.trim())return json({ok:false},409)
  }
  const found=await client.from('internal_messages').select('id,sender_user_id,body,created_at').eq('conversation_id',id).is('deleted_at',null).order('created_at',{ascending:false}).limit(101);if(found.error)throw Error()
  let checked=null
  if(params.has('message')){const lookup=await client.from('internal_messages').select('id,sender_user_id,body,created_at').eq('conversation_id',id).eq('id',coachId(params.get('message'))).eq('sender_user_id',owner).maybeSingle();if(lookup.error)throw Error();checked=lookup.data}
  const map=(r:{id:string;sender_user_id:string;body:string;created_at:string})=>({id:r.id,mine:r.sender_user_id===owner,body:r.body,createdAt:r.created_at})
  return json({ok:true,owner,student:selected,messages:(found.data??[]).slice(0,100).reverse().map(map),more:(found.data?.length??0)>100,checked:checked?map(checked):null})
 }catch{return json({ok:false,message:'Messages could not be confirmed. Refresh before sending again.'},503)}
}
export const GET=(request:Request)=>handle(request,false)
export const POST=(request:Request)=>handle(request,true)

/** The client supplies only a rendered message ID; timestamps and the participant row come from the database. */
export async function PATCH(request:Request){
 const account=await verifiedAccount(request);if(!account)return json({ok:false},401)
 try{
  const params=new URL(request.url).searchParams
  if([...params.keys()].some(k=>k!=='student'||params.getAll(k).length!==1)||!params.has('student'))return json({ok:false},400)
  let student:string,body:Record<string,unknown>
  try{student=coachId(params.get('student'));body=coachRecord(await readAccountJson(request,1200))}catch{return json({ok:false},400)}
  if(Object.keys(body).length!==1||typeof body.message!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.message))return json({ok:false},400)
  const owner=account.user.id,client=accountClient(supabaseKey,account.token),result=await client.from('coach_player_links').select('id,coach_user_id,player_user_id,status').eq('id',student).maybeSingle().retry(false),link=result.data
  if(result.error)throw Error()
  if(!link||!link.player_user_id||link.status==='paused'||![link.coach_user_id,link.player_user_id].includes(owner))return json({ok:false},404)
  const id=coachConversationId(student),conversation=await client.from('internal_conversations').select('id,conversation_type,related_entity_type,related_entity_id,participants:internal_conversation_participants!inner(profile_id)').eq('id',id).eq('participants.profile_id',owner).maybeSingle().retry(false),row=conversation.data
  if(conversation.error)throw Error()
  if(!row||row.conversation_type!=='direct'||row.related_entity_type!=='coach_student'||row.related_entity_id!==student||!Array.isArray(row.participants)||row.participants.length!==1||row.participants[0].profile_id!==owner)return json({ok:false},404)
  const saved=await markTeamChatRead(client,owner,id,body.message)
  if(!saved.ok)return json({ok:false},saved.status)
  return json({ok:true,owner,student,through:body.message})
 }catch{console.warn('native_coach_read_checkpoint_unavailable');return json({ok:false},503)}
}
