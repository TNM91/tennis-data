import type {SupabaseClient} from '@supabase/supabase-js'
import {toInternalNotification,type InternalNotification,type NotificationRow} from '../../lib/internal-notification-record'
import {readAppLink,type AppLink} from './app-links'
import {isValidCalendarDate} from '../../lib/calendar-date'

export type UpdateFilter={unread:boolean;category:'all'|'message'|'schedule'|'other'}
export type UpdateCursor={createdAt:string;id:string}
export type UpdateAction={kind:'link';link:AppLink;label:string}|{kind:'tool';destination:'lab'|'coach'|'training-inbox'|'calendar';label:string}|{kind:'conversation';id:string;label:string}
export type ResolvedUpdateAction=Exclude<UpdateAction,{kind:'conversation'}>|{kind:'coach-message';student:string;label:string}
export type UpdatePage={rows:InternalNotification[];more:boolean;cursor:UpdateCursor|null}
export const UPDATE_PAGE_SIZE=25,UPDATE_LOADED_LIMIT=100
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const date=(value:unknown):value is string=>typeof value==='string'&&timestamp.test(value)&&isValidCalendarDate(value.slice(0,10))&&Number.isFinite(Date.parse(value))
const columns='id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at'
export async function updateOwner(client:SupabaseClient,owner:string,current:()=>boolean){
  if(!uuid.test(owner)||!current())throw Error('Updates are unavailable.')
  const {data,error}=await client.auth.getSession()
  if(error||data.session?.user.id!==owner||!data.session.access_token||!current())throw Error('Sign in again to view your updates.')
  return data.session
}
export function updateCursorFilter(cursor:UpdateCursor){
  if(!uuid.test(cursor.id)||!date(cursor.createdAt))throw Error('Refresh updates before loading more.')
  // Preserve PostgreSQL microseconds rather than rounding a cursor through Date.
  return 'created_at.lt.'+cursor.createdAt+',and(created_at.eq.'+cursor.createdAt+',id.lt.'+cursor.id+')'
}
export function parseUpdatePage(value:unknown,owner:string):UpdatePage{
  if(!Array.isArray(value)||value.length>UPDATE_PAGE_SIZE+1)throw Error('Updates are unavailable.')
  const ids=new Set<string>()
  const rows=value.map(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Updates are unavailable.')
    const value=raw as Record<string,unknown>
    if(value.read_at!==null&&!date(value.read_at))throw Error('Updates are unavailable.')
    const row=toInternalNotification(raw as NotificationRow)
    if(!row||!uuid.test(row.id)||ids.has(row.id)||row.recipientProfileId!==owner||!date(row.createdAt)||row.readAt&&!date(row.readAt))throw Error('Updates are unavailable.')
    for(const key of ['title','body','href'] as const)if(typeof (raw as Record<string,unknown>)[key]!=='string')throw Error('Updates are unavailable.')
    ids.add(row.id)
    // Large legacy notices are previews; their full destination still uses existing access checks.
    return {...row,title:row.title.length>300?row.title.slice(0,300)+'…':row.title,body:row.body.length>4000?row.body.slice(0,4000)+'…':row.body,href:row.href.length>1800?'':row.href}
  }).slice(0,UPDATE_PAGE_SIZE)
  const last=rows.at(-1)
  return {rows,more:value.length>UPDATE_PAGE_SIZE,cursor:last?{createdAt:last.createdAt,id:last.id}:null}
}
export async function loadUpdates(client:SupabaseClient,owner:string,current:()=>boolean,filter:UpdateFilter,cursor:UpdateCursor|null=null):Promise<UpdatePage>{
  const session=await updateOwner(client,owner,current)
  let q=client.from('internal_notifications').select(columns).eq('recipient_profile_id',owner)
  if(filter.unread)q=q.is('read_at',null)
  if(filter.category==='other')q=q.in('notification_type',['support','system'])
  else if(filter.category!=='all')q=q.eq('notification_type',filter.category)
  if(cursor)q=q.or(updateCursorFilter(cursor))
  const {data,error}=await q.setHeader('Authorization','Bearer '+session.access_token).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(UPDATE_PAGE_SIZE+1).abortSignal(AbortSignal.timeout(12000))
  await updateOwner(client,owner,current)
  if(error)throw Error('Updates couldn’t load. Check your connection and try again.')
  return parseUpdatePage(data,owner)
}
export async function countUnreadUpdates(client:SupabaseClient,owner:string,current:()=>boolean){
  const session=await updateOwner(client,owner,current)
  const {count,error}=await client.from('internal_notifications').select('id',{head:true,count:'exact'}).eq('recipient_profile_id',owner).is('read_at',null).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000))
  await updateOwner(client,owner,current)
  if(error||typeof count!=='number'||!Number.isSafeInteger(count)||count<0)throw Error('Unread total unavailable.')
  return count
}
export async function markUpdatesRead(client:SupabaseClient,owner:string,current:()=>boolean,ids:readonly string[]){
  if(!ids.length||ids.length>UPDATE_LOADED_LIMIT||new Set(ids).size!==ids.length||ids.some(id=>!uuid.test(id)))throw Error('Refresh updates before marking them read.')
  const session=await updateOwner(client,owner,current)
  const {error}=await client.from('internal_notifications').update({read_at:new Date().toISOString()}).eq('recipient_profile_id',owner).in('id',[...ids]).is('read_at',null).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000))
  await updateOwner(client,owner,current)
  if(error)throw Error('Read status was not confirmed. Refresh updates before trying again.')
  // An empty update response cannot prove a write. Confirm owned state, including
  // already-read records, before changing the local list or opening a destination.
  const found=await client.from('internal_notifications').select('id,recipient_profile_id,read_at').eq('recipient_profile_id',owner).in('id',[...ids]).limit(UPDATE_LOADED_LIMIT).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000))
  await updateOwner(client,owner,current)
  if(found.error||!Array.isArray(found.data)||found.data.length!==ids.length)throw Error('Read status was not confirmed. Refresh updates before trying again.')
  const seen=new Set<string>()
  for(const row of found.data){if(!ids.includes(row.id)||seen.has(row.id)||row.recipient_profile_id!==owner||!date(row.read_at))throw Error('Read status was not confirmed. Refresh updates before trying again.');seen.add(row.id)}
  return found.data as {id:string;recipient_profile_id:string;read_at:string}[]
}
export function updateAction(row:InternalNotification):UpdateAction|null{
  const href=row.href
  if(!href||href.length>1800||/[\u0000-\u0020\\]/.test(href))return null
  try{
    const u=new URL(href,'https://www.tenaceiq.com')
    if(u.protocol!=='https:'||!['www.tenaceiq.com','tenaceiq.com'].includes(u.hostname)||u.username||u.password||u.port)return null
    const link=readAppLink(u.href)
    if(link)return {kind:'link',link,label:link.kind==='chat'?'Open team chat':link.kind==='league'?'Open league':link.kind==='tournament'?'Open tournament':link.kind==='match'?'Open scorecard':'Review invitation'}
    const only=(keys:string[])=>Array.from(u.searchParams.keys()).every(k=>keys.includes(k)&&u.searchParams.getAll(k).length===1)
    if(u.pathname==='/messages'&&only(['thread'])&&!u.hash){const id=u.searchParams.get('thread');if(id&&uuid.test(id)&&(!row.conversationId||row.conversationId===id))return {kind:'conversation',id,label:'Open conversation'}}
    if(u.pathname==='/coach'&&only([])&&!u.hash)return {kind:'tool',destination:'coach',label:'Open Coach & training'}
    if(u.pathname==='/mylab'&&only([])&&u.hash==='#my-calendar')return {kind:'tool',destination:'calendar',label:'Open calendar'}
    if(u.pathname==='/mylab'&&only([])&&['','#coach-assignments','#player-workshop'].includes(u.hash))return {kind:'tool',destination:u.hash==='#coach-assignments'?'training-inbox':'lab',label:u.hash==='#coach-assignments'?'Open coach plans':'Open My Lab'}
    if(/^\/level-up\/[a-z0-9-]{1,80}$/.test(u.pathname)&&only(['focus','card'])&&['','#level-up-flow'].includes(u.hash)&&[...u.searchParams.values()].every(s=>/^[a-zA-Z0-9_-]{1,100}$/.test(s)))return {kind:'tool',destination:'training-inbox',label:'Open coach plans'}
    return null
  }catch{return null}
}
export async function resolveUpdateAction(client:SupabaseClient,owner:string,current:()=>boolean,action:UpdateAction):Promise<ResolvedUpdateAction>{
  const session=await updateOwner(client,owner,current)
  if(action.kind!=='conversation')return action
  const {data,error}=await client.from('internal_conversations').select('id,conversation_type,related_entity_type,related_entity_id').eq('id',action.id).limit(1).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  await updateOwner(client,owner,current)
  if(error||!data||data.id!==action.id||data.conversation_type!=='direct'||data.related_entity_type!=='coach_student'||!uuid.test(data.related_entity_id))throw Error('This conversation is unavailable in Updates. Open Chats or Coach messages to check your current access.')
  return {kind:'coach-message',student:data.related_entity_id,label:'Open Coach messages'}
}
