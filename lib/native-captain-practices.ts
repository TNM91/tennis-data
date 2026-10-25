import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import {assignPracticeDisplayStatuses} from './captain-practice-rsvp'
const eventSelect='id,event_type,title,scheduled_date,scheduled_time,facility,recurrence_rule,status,metadata,created_by_user_id,updated_at'
const rosterSelect='id,event_id,invite_id,player_name,response_status,responded_at,captain_confirmed_at,updated_at'
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max?v:''
const timestamp=(v:unknown)=>typeof v==='string'&&v.length<=80&&Number.isFinite(Date.parse(v))
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const unique=(rows:{id:string}[])=>rows.every(r=>r.id)&&new Set(rows.map(r=>r.id)).size===rows.length
export type NativePracticePerson={id:string;name:string;response:'in'|'out'|'maybe'|'unanswered';displayStatus:'in'|'out'|'maybe'|'unanswered'|'waitlist';respondedAt:string|null;confirmedAt:string|null;updatedAt:string}
export type NativePractice={id:string;owner:string;title:string;date:string;time:string;endTime:string;facility:string;recurrence:string;status:'proposed'|'confirmed'|'completed';focus:string;updatedAt:string;capacity:number|null;inviteId:string|null;roster:NativePracticePerson[]}
export async function loadNativeCaptainPractices(service:SupabaseClient,owner:string,scope:TeamRoomScope,eventId?:string){
 const access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return access
 let query=service.from('internal_schedule_events').select(eventSelect).eq('created_by_user_id',owner).eq('event_type','captain_practice').eq('metadata->>teamName',scope.teamName).eq('metadata->>leagueName',scope.leagueName).eq('metadata->>flight',scope.flight).in('status',['proposed','confirmed','completed']).order('scheduled_date',{ascending:false}).order('id').limit(41)
 if(eventId)query=query.eq('id',eventId)
 const events=await query;if(events.error||!Array.isArray(events.data)||events.data.length>41)return {ok:false as const,status:503}
 const rows=events.data.slice(0,40)
 if(!unique(rows)||rows.some(e=>!text(e.id,120)||typeof e.title!=='string'||e.title.length>300||(e.scheduled_time!=null&&(typeof e.scheduled_time!=='string'||e.scheduled_time.length>80))||(e.facility!=null&&(typeof e.facility!=='string'||e.facility.length>300))||(e.recurrence_rule!=null&&(typeof e.recurrence_rule!=='string'||e.recurrence_rule.length>160))||(e.metadata?.practiceNotes!=null&&(typeof e.metadata.practiceNotes!=='string'||e.metadata.practiceNotes.length>3000))||e.created_by_user_id!==owner||e.event_type!=='captain_practice'||!['proposed','confirmed','completed'].includes(e.status)||e.metadata?.teamName!==scope.teamName||e.metadata?.leagueName!==scope.leagueName||e.metadata?.flight!==scope.flight||!date(e.scheduled_date)||!timestamp(e.updated_at)||(eventId&&e.id!==eventId)))return {ok:false as const,status:503}
 if(!rows.length)return {ok:true as const,status:200,scope,owner,more:false,practices:[] as NativePractice[]}
 const invites=await service.from('captain_practice_invites').select('id,event_id,capacity,created_by_user_id').eq('created_by_user_id',owner).in('event_id',rows.map(e=>e.id)).limit(41)
 if(invites.error||!Array.isArray(invites.data)||invites.data.length>40||!unique(invites.data)||new Set(invites.data.map(i=>i.event_id)).size!==invites.data.length||invites.data.some(i=>i.created_by_user_id!==owner||!rows.some(e=>e.id===i.event_id)||(i.capacity!==null&&(!Number.isInteger(i.capacity)||i.capacity<1||i.capacity>100))))return {ok:false as const,status:503}
 const roster=invites.data.length?await service.from('captain_practice_invitees').select(rosterSelect).in('invite_id',invites.data.map(i=>i.id)).in('event_id',rows.map(e=>e.id)).order('player_name').order('id').limit(2001):{data:[],error:null}
 if(roster.error||!Array.isArray(roster.data)||roster.data.length>2000||!unique(roster.data)||roster.data.some(p=>!invites.data.some(i=>i.id===p.invite_id&&i.event_id===p.event_id)||!text(p.player_name,300)||!['in','out','maybe','unanswered'].includes(p.response_status)||!timestamp(p.updated_at)||(p.responded_at!==null&&!timestamp(p.responded_at))||(p.captain_confirmed_at!==null&&!timestamp(p.captain_confirmed_at))))return {ok:false as const,status:503}
 const practices:NativePractice[]=rows.map(e=>{const invite=invites.data.find(i=>i.event_id===e.id),people=roster.data.filter(p=>p.event_id===e.id);if(people.length>250)throw Error('Practice roster exceeds the native limit');const assigned=assignPracticeDisplayStatuses(people.map(p=>({id:p.id,name:p.player_name,response:p.response_status as NativePracticePerson['response'],responseStatus:p.response_status as NativePracticePerson['response'],respondedAt:p.responded_at||'',captainConfirmedAt:p.captain_confirmed_at||'',confirmedAt:p.captain_confirmed_at as string|null,updatedAt:p.updated_at})),invite?.capacity??null);return {id:e.id,owner,title:text(e.title,300)||'Team practice',date:e.scheduled_date,time:text(e.scheduled_time,80),endTime:text(record(e.metadata).practiceEndTime,80),facility:text(e.facility,300),recurrence:text(e.recurrence_rule,160),status:e.status as NativePractice['status'],focus:text(record(e.metadata).practiceNotes,3000),updatedAt:e.updated_at,capacity:invite?.capacity??null,inviteId:invite?.id??null,roster:assigned.map(p=>({id:p.id,name:p.name,response:p.response,displayStatus:p.displayStatus,respondedAt:p.respondedAt||null,confirmedAt:p.confirmedAt,updatedAt:p.updatedAt}))}})
 return {ok:true as const,status:200,scope,owner,more:events.data.length>40,practices}
}
export async function setNativePracticeConfirmation(service:SupabaseClient,authenticated:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const eventId=text(body.eventId,120),personId=text(body.personId,120),eventRevision=text(body.eventUpdatedAt,80),revision=text(body.updatedAt,80)
 if(!eventId||!personId||typeof body.confirmed!=='boolean'||!timestamp(eventRevision)||!timestamp(revision))return {ok:false as const,status:400}
 const snapshot=await loadNativeCaptainPractices(service,owner,scope,eventId);if(!snapshot.ok)return snapshot
 const practice=snapshot.practices.find(p=>p.id===eventId),person=practice?.roster.find(p=>p.id===personId)
 if(!practice||!person)return {ok:false as const,status:404}
 if(practice.status==='completed'||practice.updatedAt!==eventRevision||person.updatedAt!==revision||person.response!=='in'||!practice.inviteId)return {ok:false as const,status:409}
 if(Boolean(person.confirmedAt)===body.confirmed)return {ok:true as const,status:200,practice}
 const now=new Date().toISOString(),result=await authenticated.from('captain_practice_invitees').update({captain_confirmed_at:body.confirmed?now:null,captain_confirmed_by_user_id:body.confirmed?owner:null}).eq('id',person.id).eq('event_id',practice.id).eq('invite_id',practice.inviteId).eq('response_status','in').eq('updated_at',person.updatedAt).select('id').maybeSingle()
 if(result.error)return {ok:false as const,status:503}
 if(!result.data)return {ok:false as const,status:409}
 const latest=await loadNativeCaptainPractices(service,owner,scope,eventId);if(!latest.ok)return latest
 const saved=latest.practices.find(p=>p.id===eventId),updated=saved?.roster.find(p=>p.id===personId)
 if(!saved||saved.status==='completed'||saved.updatedAt!==eventRevision||!updated||updated.response!=='in'||Boolean(updated.confirmedAt)!==body.confirmed)return {ok:false as const,status:409}
 return {ok:true as const,status:200,practice:saved}
}
