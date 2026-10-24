import type {SupabaseClient} from '@supabase/supabase-js'
import type {SentTeamMessage} from './team-room-message-send'
import {checkTeamChatAccess} from './team-chat-updates'
import {loadChatBlocks} from './team-chat-safety'
import {readTeamChatCursor,teamChatCursor} from './team-chat-cursor'
import {readChatMentions} from './team-chat-mentions'
import {chatSearchInput,chatSearchCursorProgress,type ChatSearchResult} from './team-chat-search-contract'
export function searchPhotoMime(row:SentTeamMessage,room:string){
 const value=row.metadata?.teamRoomAttachment;if(!value||typeof value!=='object'||Array.isArray(value))return ''
 const file=value as Record<string,unknown>,size=Number(file.size)
 return file.bucket==='team-room-files'&&typeof file.path==='string'&&file.path.startsWith(room+'/'+row.sender_user_id+'/')&&file.path.split('/').length===3&&!file.path.split('/')[2].includes('..')&&Number.isFinite(size)&&size>0&&size<=2097152&&['image/jpeg','image/png','image/webp','image/gif'].includes(String(file.mimeType))?String(file.mimeType):''
}
export function chatSearchPreview(body:string,query:string){const at=query?body.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()):0,start=Math.max(0,at-80),text=body.slice(start,start+240);return (start?'…':'')+text+(start+240<body.length?'…':'')}
/** Exact accepted scope is resolved by caller. At most 201 rows fetched, 200 inspected, 25 returned per explicit request. No storage calls or writes. */
export async function searchTeamChatRows(service:SupabaseClient,owner:string,room:string,query:unknown,kind:unknown,before:unknown){
 const input=chatSearchInput(query,kind,before);if(!input)return {ok:false as const,status:400}
 const access=await checkTeamChatAccess(service,owner,room,false);if(!access.ok)return access
 let blocked:Set<string>;try{blocked=await loadChatBlocks(service,owner)}catch{return {ok:false as const,status:503}}
 let request=service.from('internal_messages').select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id').eq('conversation_id',room).is('deleted_at',null).not('created_at','is',null)
 const cursor=input.before?readTeamChatCursor(input.before):null
 if(cursor)request=request.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
 const loaded=await request.order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(201)
 if(loaded.error||!Array.isArray(loaded.data))return {ok:false as const,status:503}
 const candidates=loaded.data.slice(0,200) as SentTeamMessage[],rows:SentTeamMessage[]=[],text=input.query.toLocaleLowerCase();let inspected=0,last:SentTeamMessage|undefined
 for(const row of candidates){inspected++;last=row;if(row.deleted_at||blocked.has(row.sender_user_id))continue
  if(input.kind==='announcements'&&row.message_kind!=='announcement'||input.kind==='media'&&!searchPhotoMime(row,room)||input.kind==='mentions'&&!readChatMentions(row.metadata?.nativeMentions,row.body||'').some(tag=>tag.profileId===owner))continue
  if(text&&!String(row.body||'').toLocaleLowerCase().includes(text))continue
  rows.push(row);if(rows.length===25)break
 }
 const more=inspected<candidates.length||loaded.data.length>200,nextCursor=more&&last?teamChatCursor(last.created_at||'',last.id):''
 if(more&&(!nextCursor||!chatSearchCursorProgress(nextCursor,input.before)))return {ok:false as const,status:503}
 return {ok:true as const,...input,beforeCursor:input.before,nextCursor,rows}
}

export function publicChatSearchResult(row:SentTeamMessage,senderName:string,room:string,query:string):ChatSearchResult{return {id:row.id,senderName:senderName.slice(0,120),preview:chatSearchPreview(String(row.body||''),query),kind:row.message_kind==='announcement'?'announcement':row.message_kind==='system'?'system':'message',createdAt:row.created_at||'',photoMimeType:searchPhotoMime(row,room)}}
