import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {buildTeamRoomScopeId,normalizeTeamRoomKey,type TeamRoomScope} from './team-room'
import {assignPracticeDisplayStatuses} from './captain-practice-rsvp'
import {practiceId,practiceStamp,type PlayerPractice} from './native-player-practice-contract'
import {calendarDate,calendarObject,calendarText,type CalendarRange} from './native-calendar-contract'
import {readCalendarPractices,type CalendarTeamPractice} from './native-calendar-practices-contract'

const unavailable=()=>Error('Team practice dates unavailable')
function rows(value:{data:unknown;error:unknown},limit:number){if(value.error||!Array.isArray(value.data)||value.data.length>limit)throw unavailable();return value.data.map(calendarObject)}
const scopeKey=(scope:TeamRoomScope)=>JSON.stringify([normalizeTeamRoomKey(scope.teamName),scope.leagueName,scope.flight])
function scopeOf(value:unknown):TeamRoomScope{const p=calendarObject(value),scope={teamName:calendarText(p.teamName,160),leagueName:calendarText(p.leagueName,160),flight:calendarText(p.flight,120)};if(!scope.teamName||!scope.leagueName)throw unavailable();return scope}

/** Bounded batch equivalent of current player-practice scope checks. Never initializes a conversation. */
async function accessibleScopes(service:SupabaseClient,owner:string,scopes:TeamRoomScope[]){
 const links=rows(await service.from('team_profile_links').select('profile_user_id,normalized_team_name,league_name,flight,status,archived_at').eq('profile_user_id',owner).eq('status','accepted').is('archived_at',null).limit(51).retry(false),50)
 if(links.some(link=>link.profile_user_id!==owner||link.status!=='accepted'||link.archived_at!==null||link.normalized_team_name!==null&&typeof link.normalized_team_name!=='string'||link.league_name!==null&&typeof link.league_name!=='string'||link.flight!==null&&typeof link.flight!=='string'))throw unavailable()
 const linked=scopes.filter(scope=>links.filter(link=>link.normalized_team_name===normalizeTeamRoomKey(scope.teamName)&&link.league_name===scope.leagueName&&link.flight===scope.flight).length===1)
 if(!linked.length)return new Set<string>()
 const ids=[...new Set(linked.map(buildTeamRoomScopeId))]
 const rooms=rows(await service.from('internal_conversations').select('id,related_entity_id,related_entity_type,status').eq('related_entity_type','team_room').in('related_entity_id',ids).limit(51).retry(false),50)
 if(rooms.some(room=>!practiceId(room.id)||room.related_entity_type!=='team_room'||!ids.includes(String(room.related_entity_id))||typeof room.status!=='string')||new Set(rooms.map(room=>room.related_entity_id)).size!==rooms.length)throw unavailable()
 const open=rooms.filter(room=>room.status!=='closed'),conversationIds=open.map(room=>room.id as string)
 if(!conversationIds.length)return new Set<string>()
 const [p,r]=await Promise.all([
  service.from('internal_conversation_participants').select('conversation_id,profile_id').eq('profile_id',owner).in('conversation_id',conversationIds).limit(51).retry(false),
  service.from('team_room_member_removals').select('conversation_id,profile_id').eq('profile_id',owner).in('conversation_id',conversationIds).limit(51).retry(false),
 ])
 const participants=rows(p,50),removals=rows(r,50)
 for(const list of [participants,removals])if(list.some(row=>row.profile_id!==owner||!conversationIds.includes(String(row.conversation_id)))||new Set(list.map(row=>row.conversation_id)).size!==list.length)throw unavailable()
 return new Set(linked.filter(scope=>open.some(room=>room.related_entity_id===buildTeamRoomScopeId(scope)&&participants.some(p=>p.conversation_id===room.id)&&!removals.some(r=>r.conversation_id===room.id))).map(scopeKey))
}

export async function nativeCalendarPractices(service:SupabaseClient,owner:string,range:CalendarRange){
 // The FK join filters by date before the owner-row limit, so old invitations do not hide this week.
 const own=rows(await service.from('captain_practice_invitees').select('id,event_id,invite_id,profile_id,event:internal_schedule_events!inner(id,event_type,title,scheduled_date,scheduled_time,facility,status,metadata,created_by_user_id)').eq('profile_id',owner).eq('event.event_type','captain_practice').gte('event.scheduled_date',range.from).lte('event.scheduled_date',range.to).order('event_id').limit(101).retry(false),100)
 if(own.some(person=>person.profile_id!==owner||!practiceId(person.id)||!practiceId(person.event_id)||!practiceId(person.invite_id))||new Set(own.map(p=>p.event_id)).size!==own.length)throw unavailable()
 const events=own.map(person=>{const event=calendarObject(person.event),scope=scopeOf(event.metadata),date=calendarDate(event.scheduled_date);if(event.created_by_user_id!==null&&!practiceId(event.created_by_user_id)||event.id!==person.event_id||event.event_type!=='captain_practice'||date<range.from||date>range.to)throw unavailable();return {person,event,scope}})
 if(!events.length)return {owner,range,practices:[] as CalendarTeamPractice[]}
 const access=await accessibleScopes(service,owner,[...new Map(events.map(row=>[scopeKey(row.scope),row.scope])).values()])
 const allowed=events.filter(row=>access.has(scopeKey(row.scope)))
 if(!allowed.length)return {owner,range,practices:[] as CalendarTeamPractice[]}
 const eventIds=allowed.map(row=>row.event.id as string),inviteIds=allowed.map(row=>row.person.invite_id as string)
 const [i,p]=await Promise.all([
  service.from('captain_practice_invites').select('id,event_id,capacity,created_by_user_id').in('id',inviteIds).in('event_id',eventIds).limit(101).retry(false),
  service.from('captain_practice_invitees').select('id,event_id,invite_id,response_status,responded_at,captain_confirmed_at,updated_at').in('invite_id',inviteIds).in('event_id',eventIds).limit(5001).retry(false),
 ])
 const invites=rows(i,100),people=rows(p,5000)
 if(invites.length!==allowed.length||new Set(invites.map(v=>v.event_id)).size!==allowed.length||invites.some(v=>!allowed.some(row=>row.person.invite_id===v.id&&row.event.id===v.event_id&&row.event.created_by_user_id===v.created_by_user_id)||v.capacity!==null&&(!Number.isInteger(v.capacity)||Number(v.capacity)<1||Number(v.capacity)>100)))throw unavailable()
 if(new Set(people.map(p=>p.id)).size!==people.length||people.some(p=>!practiceId(p.id)||!invites.some(i=>i.id===p.invite_id&&i.event_id===p.event_id)||!['in','out','maybe','unanswered'].includes(String(p.response_status))||!practiceStamp(p.updated_at)||p.responded_at!==null&&!practiceStamp(p.responded_at)||p.captain_confirmed_at!==null&&!practiceStamp(p.captain_confirmed_at)))throw unavailable()
 const practices=allowed.map(({person,event,scope})=>{
  const invite=invites.find(i=>i.id===person.invite_id)!,roster=people.filter(p=>p.event_id===event.id)
  if(roster.length>250)throw unavailable()
  const mine=assignPracticeDisplayStatuses(roster.map(p=>({id:String(p.id),responseStatus:p.response_status as PlayerPractice['mine']['response'],respondedAt:String(p.responded_at||''),captainConfirmedAt:String(p.captain_confirmed_at||'')})),invite.capacity as number|null).find(p=>p.id===person.id)
  if(!mine||mine.captainConfirmedAt&&mine.responseStatus!=='in')throw unavailable()
  return {id:event.id,title:event.title,date:event.scheduled_date,time:event.scheduled_time||'',endTime:calendarObject(event.metadata).practiceEndTime||'',location:event.facility||'',status:event.status,response:mine.displayStatus,captainConfirmed:!!mine.captainConfirmedAt,scope}
 })
 return {owner,range,practices:readCalendarPractices({ok:true,owner,range,practices},owner,range)}
}
