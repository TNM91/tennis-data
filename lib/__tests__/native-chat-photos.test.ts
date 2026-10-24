import {describe,it,expect,vi} from 'vitest'
import sharp from 'sharp'
import type {SupabaseClient} from '@supabase/supabase-js'
import {boundedChatJson,normalizeChatPhoto,readChatPhoto,sendChatPhoto} from '../native-chat-photos'
import {ChatActionError,TeamChatDraft,type ChatAction} from '../../mobile/src/team-chat-send'
import {privatePhotoData,localCameraSource} from '../../mobile/src/chat-photos'
const id='1959be10-4557-4a03-87bd-584ba14ff519'
async function image(){return (await sharp({create:{width:20,height:10,channels:3,background:'#436b31'}}).jpeg().withMetadata({orientation:6}).toBuffer()).toString('base64')}
function db(existing:unknown=null,blocks:unknown[]=[],insertError:unknown=null){
 const upload=vi.fn().mockResolvedValue({error:null}),download=vi.fn(),insert=vi.fn(),queries:{table:string;method:string;args:unknown[]}[]=[]
 let inserted:unknown=null
 const service={storage:{from:()=>({upload,download})},from:(table:string)=>{
  const q:Record<string,unknown>={then:(resolve:(result:unknown)=>unknown)=>Promise.resolve(resolve({data:blocks,error:null})),maybeSingle:async()=>({data:existing,error:null}),single:async()=>({data:inserted,error:insertError})}
  for(const method of ['select','eq','is','limit'])q[method]=(...args:unknown[])=>{queries.push({table,method,args});return q}
  q.insert=(row:unknown)=>{insert(row);inserted=row;return q};return q
 }} as unknown as SupabaseClient
 return {service,upload,download,insert,queries}
}
describe('private native chat photos',()=>{
 it('validates real still-image bytes, rotates and strips metadata',async()=>{
  const normalized=await normalizeChatPhoto(await image()),metadata=await sharp(normalized.bytes).metadata()
  expect(metadata).toMatchObject({format:'jpeg',width:10,height:20});expect(metadata.exif).toBeUndefined();expect(metadata.orientation).toBeUndefined();expect(normalized.sha256).toHaveLength(64)
  for(const value of ['<svg/>',Buffer.from('<svg/>').toString('base64'),'a'.repeat(2800000)])await expect(normalizeChatPhoto(value)).rejects.toThrow()
 })
 it('uses an immutable owner/room/send key and replays a matching saved photo without another upload',async()=>{
  const input={clientMessageId:id,body:'Courts are ready',photoBase64:await image()},database=db()
  const first=await sendChatPhoto(database.service,'owner','room',input)
  expect(first.ok).toBe(true);expect(database.upload.mock.calls[0][0]).toBe('room/owner/'+id+'-photo.jpg');expect(database.upload.mock.calls[0][2]).toMatchObject({upsert:false,contentType:'image/jpeg'})
  const replay=db({...database.insert.mock.calls[0][0],edited_at:null,deleted_at:null})
  expect(await sendChatPhoto(replay.service,'owner','room',input)).toMatchObject({ok:true,replayed:true});expect(replay.upload).not.toHaveBeenCalled()
  expect(await sendChatPhoto(replay.service,'other','room',input)).toMatchObject({status:409});expect(replay.upload).not.toHaveBeenCalled()
 })
 it('rejects blocked, deleted, foreign-message and foreign-object reads before downloading',async()=>{
  for(const database of [db(null),db({sender_user_id:'blocked'},[{blocked_user_id:'blocked'}]),db({sender_user_id:'owner',metadata:{teamRoomAttachment:{bucket:'team-room-files',path:'different/owner/photo.jpg',mimeType:'image/jpeg',size:12}}})]){
   expect((await readChatPhoto(database.service,'viewer','room',id)).ok).toBe(false);expect(database.download).not.toHaveBeenCalled()
   expect(database.queries).toContainEqual({table:'internal_messages',method:'eq',args:['conversation_id','room']})
   expect(database.queries).toContainEqual({table:'internal_messages',method:'is',args:['deleted_at',null]})
  }
 })
 it('recovers the same uploaded object after a lost upload response and refuses changed bytes',async()=>{
  const photoBase64=await image(),normalized=await normalizeChatPhoto(photoBase64),input={clientMessageId:id,photoBase64}
  const database=db();database.upload.mockResolvedValue({error:{statusCode:'409'}});database.download.mockResolvedValue({data:new Blob([new Uint8Array(normalized.bytes)]),error:null})
  expect(await sendChatPhoto(database.service,'owner','room',input)).toMatchObject({ok:true,replayed:false});expect(database.insert).toHaveBeenCalledTimes(1)
  const conflict=db();conflict.upload.mockResolvedValue({error:{statusCode:'409'}});conflict.download.mockResolvedValue({data:new Blob(['different']),error:null})
  expect(await sendChatPhoto(conflict.service,'owner','room',input)).toMatchObject({status:409});expect(conflict.insert).not.toHaveBeenCalled()
 })
 it('returns authenticated photo bytes without a public URL and keeps ambiguous objects for the same-key retry',async()=>{
  const base64=await image(),database=db({sender_user_id:'owner',metadata:{teamRoomAttachment:{bucket:'team-room-files',path:'room/owner/photo.jpg',mimeType:'image/jpeg',size:1000}}})
  database.download.mockResolvedValue({data:new Blob([new Uint8Array(Buffer.from(base64,'base64'))]),error:null})
  const result=await readChatPhoto(database.service,'viewer','room',id);expect(result).toMatchObject({ok:true,messageId:id,mimeType:'image/jpeg'});expect(JSON.stringify(result)).not.toContain('https:')
  const uncertain=db(null,[],{code:'NETWORK'});expect(await sendChatPhoto(uncertain.service,'owner','room',{clientMessageId:id,photoBase64:base64})).toMatchObject({status:503});expect(uncertain.upload).toHaveBeenCalledTimes(1)
 })
 it('returns a bounded thumbnail only after the same private message checks',async()=>{
  const bytes=await sharp({create:{width:1200,height:800,channels:3,background:'#254e34'}}).jpeg().toBuffer()
  const database=db({sender_user_id:'owner',metadata:{teamRoomAttachment:{bucket:'team-room-files',path:'room/owner/photo.jpg',mimeType:'image/jpeg',size:bytes.length}}})
  database.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null})
  const result=await readChatPhoto(database.service,'viewer','room',id,true)
  expect(result.ok).toBe(true);if(!result.ok)return
  const thumb=Buffer.from(result.base64,'base64'),metadata=await sharp(thumb).metadata()
  expect(metadata.width).toBe(320);expect(metadata.height).toBeLessThanOrEqual(320);expect(thumb.length).toBeLessThanOrEqual(96000)
 })
 it('bounds streamed JSON bodies rather than trusting Content-Length',async()=>{
  expect(await boundedChatJson(new Request('https://local.test',{method:'POST',body:JSON.stringify({action:'read_chat_photo'})}))).toEqual({action:'read_chat_photo'})
  await expect(boundedChatJson(new Request('https://local.test',{method:'POST',body:'x'.repeat(2900001)}))).rejects.toThrow('large')
  await expect(boundedChatJson(new Request('https://local.test',{method:'POST',body:'[]'}))).rejects.toThrow('Invalid')
 })
 it('retains the exact photo and caption for uncertain retries, then clears private data',async()=>{
  let fail=true;const send=vi.fn(async(_action:ChatAction)=>{void _action;if(fail){fail=false;throw new ChatActionError('Uncertain',true)}}),draft=new TeamChatDraft(send,()=>id)
  draft.photo={base64:'photo',preview:'data:image/jpeg;base64,photo'};draft.text='  Ready  '
  expect(await draft.submit()).toBe(false);expect(draft.photo).not.toBeNull();expect(await draft.submit()).toBe(true)
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);expect(send.mock.calls[0][0]).toMatchObject({action:'send_chat_photo',photoBase64:'photo',body:'Ready',clientMessageId:id});expect(draft.photo).toBeNull()
  draft.photo={base64:'private',preview:'private'};draft.dispose();expect(draft.photo).toBeNull()
 })
 it('accepts native Capacitor file URLs without opening arbitrary remote image origins',()=>{
  expect(localCameraSource('capacitor://localhost/_capacitor_file_/private/photo.jpg','capacitor://localhost/index.html')).toBe(true)
  expect(localCameraSource('https://untrusted.invalid/photo.jpg','capacitor://localhost/index.html')).toBe(false)
  expect(localCameraSource('capacitor://otherhost/photo.jpg','capacitor://localhost/index.html')).toBe(false)
 })
 it('allows only bounded JPEG data in the private viewer',()=>{
  expect(privatePhotoData({ok:true,mimeType:'image/jpeg',base64:'/9j/'})).toBe('data:image/jpeg;base64,/9j/')
  for(const data of [{ok:true,mimeType:'image/svg+xml',base64:'PHN2Zz4='},{ok:true,mimeType:'image/jpeg',base64:'" onerror=bad'},{ok:false,mimeType:'image/jpeg',base64:'/9j/'}])expect(()=>privatePhotoData(data)).toThrow()
 })
})
