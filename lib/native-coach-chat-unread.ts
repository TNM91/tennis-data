import 'server-only'
import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {coachId} from './native-coach-contract'
import {chatTimestamp} from './chat-timestamp'

export const coachConversationId=(link:string)=>{const h=createHash('sha256').update('tenaceiq:coach-direct:v1:'+link).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32)}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const stamp=(v:unknown)=>{if(typeof v!=='string'||v.length>80||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v))throw Error('Coach counts unavailable');const parsed=chatTimestamp(v);if(parsed===null)throw Error('Coach counts unavailable');return parsed}

/** Two bounded, owner/RLS-scoped reads. Embedded limits apply independently to each conversation. */
export async function nativeCoachChatUnread(client:SupabaseClient,owner:string){
 if(!uuid(owner))throw Error('Coach counts unavailable')
 const deadline=AbortSignal.timeout(8000)
 const links=await client.from('coach_player_links').select('id,coach_user_id,player_user_id,status').or('coach_user_id.eq.'+owner+',player_user_id.eq.'+owner).neq('status','paused').not('player_user_id','is',null).limit(101).abortSignal(deadline).retry(false)
 if(links.error||!Array.isArray(links.data)||links.data.length>100)throw Error('Coach counts unavailable')
 const expected=new Map<string,{id:string;other:string;unread:number;latest:string|null;latestTime:ReturnType<typeof stamp>|null}>(),ids=new Set<string>()
 for(const link of links.data){
  const id=coachId(link.id)
  if(ids.has(id)||!uuid(link.coach_user_id)||!uuid(link.player_user_id)||![link.coach_user_id,link.player_user_id].includes(owner)||!['active','needs_assignment','review_notes'].includes(link.status))throw Error('Coach counts unavailable')
  ids.add(id);expected.set(coachConversationId(id),{id,other:link.coach_user_id===owner?link.player_user_id:link.coach_user_id,unread:0,latest:null,latestTime:null})
 }
 if(expected.size){
  const result=await client.from('internal_conversations').select('id,conversation_type,related_entity_type,related_entity_id,status,participants:internal_conversation_participants!inner(profile_id,last_read_at),posts:internal_messages(id,conversation_id,sender_user_id,created_at,deleted_at)')
   .in('id',[...expected.keys()]).eq('conversation_type','direct').eq('related_entity_type','coach_student').neq('status','closed').eq('participants.profile_id',owner)
   .neq('posts.sender_user_id',owner).is('posts.deleted_at',null).order('created_at',{referencedTable:'posts',ascending:false}).order('id',{referencedTable:'posts',ascending:false}).limit(100,{referencedTable:'posts'}).limit(101).abortSignal(deadline).retry(false)
  if(result.error||!Array.isArray(result.data)||result.data.length>100||JSON.stringify(result.data).length>2500000)throw Error('Coach counts unavailable')
  const seen=new Set<string>()
  for(const row of result.data){
   const connection=expected.get(row.id)
   if(!connection||seen.has(row.id)||row.conversation_type!=='direct'||row.related_entity_type!=='coach_student'||row.related_entity_id!==connection.id||!['open','waiting_on_user','waiting_on_admin'].includes(row.status)||!Array.isArray(row.participants)||row.participants.length!==1||row.participants[0].profile_id!==owner||!Array.isArray(row.posts)||row.posts.length>100)throw Error('Coach counts unavailable')
   seen.add(row.id);const read=row.participants[0].last_read_at==null?null:stamp(row.participants[0].last_read_at),posts=new Set<string>()
   for(const post of row.posts){
    if(!uuid(post.id)||posts.has(post.id)||post.conversation_id!==row.id||post.sender_user_id!==connection.other||post.sender_user_id===owner||post.deleted_at!==null)throw Error('Coach counts unavailable')
    posts.add(post.id);const time=stamp(post.created_at);if(read===null||time>read)connection.unread++
    if(connection.latestTime===null||time>connection.latestTime||time===connection.latestTime&&post.id>connection.latest!){connection.latest=post.id;connection.latestTime=time}
   }
  }
 }
 const connections=[...expected.values()].map(({id,unread,latest})=>({id,unread,latest}))
 return {available:true as const,total:Math.min(100,connections.reduce((sum,c)=>sum+c.unread,0)),connections}
}
