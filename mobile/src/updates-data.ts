import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp} from '@capacitor/core'
import {toInternalNotification,type InternalNotification,type NotificationRow} from '../../lib/internal-notification-record'
import {confirmUpdatesRead,UPDATE_PAGE_SIZE,UPDATE_LOADED_LIMIT,updateId,updateTimestamp as date,updateCursorFilter,validUpdateIds,type UpdateFilter,type UpdateCursor} from '../../lib/native-updates-contract'
import {readAppLink,type AppLink} from './app-links'
import {getMyTournamentEntries} from './tournament-entry-data'
import {firstPartyBuild} from './build-scope'
import {readPracticeReminderDestination} from '../../lib/native-practice-reminder-contract'
import {leagueScheduleUpdateLink} from '../../lib/native-league-schedule-contract'
import {leagueScoreUpdateLink} from '../../lib/native-league-score-contract'
import type {TeamScope} from './team-room-data'

export {UPDATE_PAGE_SIZE,UPDATE_LOADED_LIMIT,updateCursorFilter,type UpdateFilter,type UpdateCursor} from '../../lib/native-updates-contract'
export type UpdateAction={kind:'link';link:AppLink;label:string}|{kind:'tool';destination:'lab'|'coach'|'training-inbox'|'calendar'|'tournament-entries';label:string}|{kind:'conversation';id:string;label:string}|{kind:'coach-message';student:string;label:string}|{kind:'coach-plan';planId:string;label:string}|{kind:'tournament-entry';division:string;label:string}|{kind:'practice-reminder';eventId:string;scope:TeamScope;label:string}|{kind:'league-schedule';leagueId:string;matchId:string;label:string}|{kind:'league-score';leagueId:string;matchId:string;label:string}
export type ResolvedUpdateAction=Exclude<UpdateAction,{kind:'conversation'|'tournament-entry'}>|{kind:'tournament-entry';parent:string;division:string;receiptId:string;label:string}
export type UpdatePage={rows:InternalNotification[];more:boolean;cursor:UpdateCursor|null}
const columns='id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at'
export async function updateOwner(client:SupabaseClient,owner:string,current:()=>boolean){
  if(!updateId(owner)||!current())throw Error('Updates are unavailable.')
  const {data,error}=await client.auth.getSession()
  if(error||data.session?.user.id!==owner||!data.session.access_token||!current())throw Error('Sign in again to view your updates.')
  return data.session
}
async function firstPartyUpdatesRequest(client:SupabaseClient,owner:string,current:()=>boolean,token:string,params:Record<string,string>,ids?:readonly string[]){
  const url=new URL('https://www.tenaceiq.com/api/mobile/first-party/updates')
  url.search=new URLSearchParams(params).toString()
  const options={url:url.href,headers:{Authorization:'Bearer '+token,'Cache-Control':'no-store'},responseType:'json' as const,
    disableRedirects:true,connectTimeout:12000,readTimeout:12000,webFetchExtra:{cache:'no-store' as const}}
  const response=ids?await CapacitorHttp.post({...options,headers:{...options.headers,'Content-Type':'application/json'},data:{ids}}):await CapacitorHttp.get(options)
  await updateOwner(client,owner,current)
  const row=response.data as {ok?:unknown;owner?:unknown;releaseScope?:unknown;rows?:unknown;count?:unknown}|null
  if(response.status!==200||row?.ok!==true||row.owner!==owner||row.releaseScope!=='first-party'){
    throw Error(ids?'Read status was not confirmed. Refresh updates before trying again.':'Updates couldn’t load. Check your connection and try again.')
  }
  return row
}
export function parseUpdatePage(value:unknown,owner:string):UpdatePage{
  if(!Array.isArray(value)||value.length>UPDATE_PAGE_SIZE+1)throw Error('Updates are unavailable.')
  const ids=new Set<string>()
  const rows=value.map(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Updates are unavailable.')
    const value=raw as Record<string,unknown>
    if(value.read_at!==null&&!date(value.read_at))throw Error('Updates are unavailable.')
    const row=toInternalNotification(raw as NotificationRow)
    if(!row||!updateId(row.id)||ids.has(row.id)||row.recipientProfileId!==owner||!date(row.createdAt)||row.readAt&&!date(row.readAt))throw Error('Updates are unavailable.')
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
  if(firstPartyBuild){
    if(cursor)updateCursorFilter(cursor)
    const row=await firstPartyUpdatesRequest(client,owner,current,session.access_token,{unread:filter.unread?'1':'0',category:filter.category,...(cursor?{before:cursor.createdAt,id:cursor.id}:{})})
    return parseUpdatePage(row.rows,owner)
  }
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
  if(firstPartyBuild){
    const {count}=await firstPartyUpdatesRequest(client,owner,current,session.access_token,{op:'count'})
    if(typeof count!=='number'||!Number.isSafeInteger(count)||count<0)throw Error('Unread total unavailable.')
    return count
  }
  const {count,error}=await client.from('internal_notifications').select('id',{head:true,count:'exact'}).eq('recipient_profile_id',owner).is('read_at',null).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000))
  await updateOwner(client,owner,current)
  if(error||typeof count!=='number'||!Number.isSafeInteger(count)||count<0)throw Error('Unread total unavailable.')
  return count
}
export async function markUpdatesRead(client:SupabaseClient,owner:string,current:()=>boolean,ids:readonly string[]){
  if(!validUpdateIds(ids))throw Error('Refresh updates before marking them read.')
  const session=await updateOwner(client,owner,current)
  if(firstPartyBuild){
    const {rows}=await firstPartyUpdatesRequest(client,owner,current,session.access_token,{},ids)
    return confirmUpdatesRead(rows,owner,ids)
  }
  const {error}=await client.from('internal_notifications').update({read_at:new Date().toISOString()}).eq('recipient_profile_id',owner).in('id',[...ids]).is('read_at',null).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000))
  await updateOwner(client,owner,current)
  if(error)throw Error('Read status was not confirmed. Refresh updates before trying again.')
  // An empty update response cannot prove a write. Confirm owned state, including
  // already-read records, before changing the local list or opening a destination.
  const found=await client.from('internal_notifications').select('id,recipient_profile_id,read_at').eq('recipient_profile_id',owner).in('id',[...ids]).limit(UPDATE_LOADED_LIMIT).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000))
  await updateOwner(client,owner,current)
  if(found.error)throw Error('Read status was not confirmed. Refresh updates before trying again.')
  return confirmUpdatesRead(found.data,owner,ids)
}
export function updateAction(row:InternalNotification):UpdateAction|null{
  const href=row.href
  if(!href||href.length>1800||/[\u0000-\u0020\\]/.test(href))return null
  try{
    const u=new URL(href,'https://www.tenaceiq.com')
    if(u.protocol!=='https:'||!['www.tenaceiq.com','tenaceiq.com'].includes(u.hostname)||u.username||u.password||u.port)return null
    if(row.notificationType==='schedule'){
      const league=leagueScheduleUpdateLink(u)
      if(league&&!row.scheduleEventId&&!row.conversationId)return {kind:'league-schedule',...league,label:'Open league match'}
      const practice=readPracticeReminderDestination(u,row.scheduleEventId,row.conversationId)
      if(practice)return {kind:'practice-reminder',...practice,label:'Open practice RSVP'}
    }
    const only=(keys:string[])=>Array.from(u.searchParams.keys()).every(k=>keys.includes(k)&&u.searchParams.getAll(k).length===1)
    if(u.pathname==='/level-up/my-quest'&&u.hash==='#level-up-coach-update'&&only(['coachUpdate'])){
      const planId=u.searchParams.get('coachUpdate')?.trim()
      if(planId&&planId.length<=240&&!/[\u0000-\u001f\u007f]/.test(planId))return {kind:'coach-plan',planId,label:'Open coach update'}
    }
    if(firstPartyBuild){
      const score=row.notificationType==='system'&&!row.conversationId&&!row.scheduleEventId?leagueScoreUpdateLink(u):undefined
      if(score)return {kind:'league-score',...score,label:'Open scorecard'}
      const chat=row.notificationType==='message'&&!row.scheduleEventId?readAppLink(u.href):null
      if(chat?.kind==='player-chat'&&chat.id===row.conversationId)return {kind:'link',link:chat,label:'Open chat'}
      const student=u.searchParams.get('coach')
      return row.notificationType==='message'&&u.pathname==='/messages'&&only(['coach'])&&!u.hash&&updateId(student)
        ? {kind:'coach-message',student,label:'Open Coach messages'} : null
    }
    const tournamentDecision=row.notificationType==='system'&&(row.title==='Tournament entry approved'||row.title==='Tournament entry update')
    const link=readAppLink(u.href)
    if(tournamentDecision&&link?.kind==='tournament')return {kind:'tournament-entry',division:link.id,label:'Open tournament entry'}
    if(tournamentDecision&&u.pathname==='/compete'&&!u.search&&u.hash==='#my-entries'){
      return {kind:'tool',destination:'tournament-entries',label:'Open tournament entries'}
    }
    if(link)return {kind:'link',link,label:link.kind==='chat'?'Open team chat':link.kind==='league'?'Open league':link.kind==='tournament'?'Open tournament':link.kind==='match'?'Open scorecard':'Review invitation'}
    if(u.pathname==='/messages'&&only(['thread'])&&!u.hash){const id=u.searchParams.get('thread');if(updateId(id)&&(!row.conversationId||row.conversationId===id))return {kind:'conversation',id,label:'Open conversation'}}
    if(u.pathname==='/coach'&&only([])&&!u.hash)return {kind:'tool',destination:'coach',label:'Open Coach & training'}
    if(u.pathname==='/mylab'&&only([])&&u.hash==='#my-calendar')return {kind:'tool',destination:'calendar',label:'Open calendar'}
    if(u.pathname==='/mylab'&&only([])&&['','#coach-assignments','#player-workshop'].includes(u.hash))return {kind:'tool',destination:u.hash==='#coach-assignments'?'training-inbox':'lab',label:u.hash==='#coach-assignments'?'Open coach plans':'Open My Lab'}
    if(/^\/level-up\/[a-z0-9-]{1,80}$/.test(u.pathname)&&only(['focus','card'])&&['','#level-up-flow'].includes(u.hash)&&[...u.searchParams.values()].every(s=>/^[a-zA-Z0-9_-]{1,100}$/.test(s)))return {kind:'tool',destination:'training-inbox',label:'Open coach plans'}
    return null
  }catch{return null}
}
export async function resolveUpdateAction(client:SupabaseClient,owner:string,current:()=>boolean,action:UpdateAction):Promise<ResolvedUpdateAction>{
  if(firstPartyBuild&&(action.kind==='conversation'||action.kind==='tournament-entry'))throw Error('This update is unavailable.')
  if(action.kind==='tournament-entry'){
    const {entries}=await getMyTournamentEntries(client,owner,current,action.division)
    const entry=entries[0]
    if(entries.length!==1||entry?.selection?.division!==action.division){
      throw Error('This entry is unavailable. Check My Tournament Entries in Compete.')
    }
    return {kind:'tournament-entry',...entry.selection,receiptId:entry.id,label:action.label}
  }
  const session=await updateOwner(client,owner,current)
  if(action.kind!=='conversation')return action
  const {data,error}=await client.from('internal_conversations').select('id,conversation_type,related_entity_type,related_entity_id').eq('id',action.id).limit(1).setHeader('Authorization','Bearer '+session.access_token).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  await updateOwner(client,owner,current)
  if(error||!data||data.id!==action.id||data.conversation_type!=='direct'||data.related_entity_type!=='coach_student'||!updateId(data.related_entity_id))throw Error('This conversation is unavailable in Updates. Open Chats or Coach messages to check your current access.')
  return {kind:'coach-message',student:data.related_entity_id,label:'Open Coach messages'}
}
