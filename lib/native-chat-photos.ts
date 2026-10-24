import sharp from 'sharp'
import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadChatBlocks} from './team-chat-safety'
import {parseTeamMessageSendId,type SentTeamMessage} from './team-room-message-send'
export const maxChatPhotoBytes=2*1024*1024
const columns='id,conversation_id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id'
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
export async function normalizeChatPhoto(base64:unknown,preview=false){
 if(typeof base64!=='string' || base64.length>Math.ceil(maxChatPhotoBytes/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw Error('Choose a photo up to 2 MB.')
 const input=Buffer.from(base64,'base64')
 if(!input.length || input.length>maxChatPhotoBytes || input.toString('base64')!==base64)throw Error('Invalid photo.')
 const image=sharp(input,{limitInputPixels:16000000,animated:false}),metadata=await image.metadata()
 if(!['jpeg','png','webp'].includes(metadata.format || '') || (metadata.pages || 1)>1)throw Error('Choose a still JPG, PNG or WebP photo.')
 const bytes=await image.rotate().resize(preview?320:1600,preview?320:1600,{fit:'inside',withoutEnlargement:true}).jpeg({quality:preview?65:82}).toBuffer()
 if(bytes.length>maxChatPhotoBytes)throw Error('Choose a smaller photo.')
 return {bytes,sha256:hash(bytes)}
}
export async function boundedChatJson(request:Request){
 const limit=2900000,reader=request.body?.getReader();if(!reader)throw Error('Missing request')
 const chunks:Uint8Array[]=[];let size=0
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>limit){await reader.cancel();throw Error('Request too large')}chunks.push(item.value)}}finally{reader.releaseLock()}
 const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body || typeof body!=='object' || Array.isArray(body))throw Error('Invalid request');return body
}
function attachment(row:SentTeamMessage){const value=row.metadata?.teamRoomAttachment;return value && typeof value==='object'?value as Record<string,unknown>:null}
export async function readChatPhoto(service:SupabaseClient,owner:string,room:string,id:unknown,preview=false){
 if(!parseTeamMessageSendId(id))return {ok:false as const,status:400}
 const result=await service.from('internal_messages').select(columns).eq('id',id).eq('conversation_id',room).is('deleted_at',null).maybeSingle()
 if(result.error)return {ok:false as const,status:503}
 const row=result.data as SentTeamMessage|null;if(!row)return {ok:false as const,status:404}
 const blocked=await loadChatBlocks(service,owner);if(blocked.has(row.sender_user_id))return {ok:false as const,status:404}
 const file=attachment(row)
 if(!file || file.bucket!=='team-room-files' || typeof file.path!=='string' || !file.path.startsWith(room+'/'+row.sender_user_id+'/') || file.path.split('/').length!==3 || file.path.split('/')[2].includes('..') || !['image/jpeg','image/png','image/webp'].includes(String(file.mimeType)) || Number(file.size)>maxChatPhotoBytes)return {ok:false as const,status:404}
 const download=await service.storage.from('team-room-files').download(file.path)
 if(download.error || !download.data || download.data.size>maxChatPhotoBytes)return {ok:false as const,status:503}
 const normalized=await normalizeChatPhoto(Buffer.from(await download.data.arrayBuffer()).toString('base64'),preview)
 const bytes=normalized.bytes
 if(preview && bytes.length>96000)return {ok:false as const,status:503}
 return {ok:true as const,status:200,messageId:id,mimeType:'image/jpeg',base64:bytes.toString('base64')}
}
/** Caller verifies accepted exact team scope and current participation. */
export async function sendChatPhoto(service:SupabaseClient,owner:string,room:string,input:{clientMessageId?:unknown;body?:unknown;replyToMessageId?:unknown;photoBase64?:unknown}){
 const id=parseTeamMessageSendId(input.clientMessageId),reply=input.replyToMessageId?parseTeamMessageSendId(input.replyToMessageId):null
 if(!id || reply===false)return {ok:false as const,status:400}
 const caption=typeof input.body==='string'?input.body.trim().slice(0,2400):'',body=caption || 'Shared a photo.'
 const blocked=await loadChatBlocks(service,owner)
 if(reply){const target=await service.from('internal_messages').select('sender_user_id').eq('id',reply).eq('conversation_id',room).is('deleted_at',null).maybeSingle();if(target.error)return {ok:false as const,status:503};if(!target.data || blocked.has(target.data.sender_user_id))return {ok:false as const,status:404}}
 let photo:Awaited<ReturnType<typeof normalizeChatPhoto>>;try{photo=await normalizeChatPhoto(input.photoBase64)}catch{return {ok:false as const,status:400}}
 const existing=await service.from('internal_messages').select(columns).eq('id',id).maybeSingle()
 if(existing.error)return {ok:false as const,status:503}
 const matches=(row:SentTeamMessage & {conversation_id?:string})=>row.conversation_id===room && row.sender_user_id===owner && row.body===body && row.message_kind==='message' && row.reply_to_message_id===reply && !row.deleted_at && !row.edited_at && row.metadata?.nativePhotoSha256===photo.sha256
 if(existing.data)return matches(existing.data)?{ok:true as const,status:200,message:existing.data as SentTeamMessage,replayed:true}:{ok:false as const,status:409}
 const path=room+'/'+owner+'/'+id+'-photo.jpg',bucket=service.storage.from('team-room-files')
 const upload=await bucket.upload(path,photo.bytes,{contentType:'image/jpeg',upsert:false,cacheControl:'0'})
 if(upload.error){
  if(String(upload.error.statusCode)!=='409')return {ok:false as const,status:503}
  const stored=await bucket.download(path)
  if(stored.error || !stored.data || stored.data.size>maxChatPhotoBytes || hash(Buffer.from(await stored.data.arrayBuffer()))!==photo.sha256)return {ok:false as const,status:409}
 }
 const metadata={nativePhotoSha256:photo.sha256,teamRoomAttachment:{bucket:'team-room-files',path,name:'Team photo.jpg',mimeType:'image/jpeg',size:photo.bytes.length}}
 const inserted=await service.from('internal_messages').insert({id,conversation_id:room,sender_user_id:owner,body,message_kind:'message',reply_to_message_id:reply,metadata}).select(columns).single()
 if(!inserted.error && inserted.data)return {ok:true as const,status:200,message:inserted.data as SentTeamMessage,replayed:false}
 if(inserted.error?.code==='23505'){const retry=await service.from('internal_messages').select(columns).eq('id',id).maybeSingle();if(!retry.error && retry.data && matches(retry.data))return {ok:true as const,status:200,message:retry.data as SentTeamMessage,replayed:true}}
 // An ambiguous insert may already reference this object. Keep its immutable key for retry.
 return {ok:false as const,status:503}
}
