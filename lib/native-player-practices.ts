import type {SupabaseClient} from '@supabase/supabase-js'
import {buildTeamRoomScopeId,normalizeTeamRoomKey,type TeamRoomScope} from './team-room'
import {checkTeamChatAccess} from './team-chat-updates'
import {assignPracticeDisplayStatuses} from './captain-practice-rsvp'
import {practiceId,practiceStamp,validPlayerPracticeReply,type PlayerPractice} from './native-player-practice-contract'
export async function authorizePlayerPracticeScope(service:SupabaseClient,owner:string,scope:TeamRoomScope){
 if(!scope.teamName.trim()||!scope.leagueName.trim()||scope.teamName.length>160||scope.leagueName.length>160||scope.flight.length>120)return {ok:false as const,status:400}
 const links=await service.from('team_profile_links').select('id').eq('profile_user_id',owner).eq('normalized_team_name',normalizeTeamRoomKey(scope.teamName)).eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('status','accepted').is('archived_at',null).limit(2)
 if(links.error)return {ok:false as const,status:503};if(links.data?.length!==1)return {ok:false as const,status:403}
 const room=await service.from('internal_conversations').select('id,status').eq('related_entity_type','team_room').eq('related_entity_id',buildTeamRoomScopeId(scope)).maybeSingle()
 if(room.error)return {ok:false as const,status:503};if(!room.data||room.data.status==='closed')return {ok:false as const,status:403}
 const access=await checkTeamChatAccess(service,owner,room.data.id,false);return access.ok?{ok:true as const,status:200}:access
}
const str=(v:unknown,n:number,empty=true):v is string=>typeof v==='string'&&v.length<=n&&(empty||!!v.trim())
export async function loadPlayerPractices(service:SupabaseClient,owner:string,scope:TeamRoomScope,id=''){
 if(id&&!practiceId(id))return {ok:false as const,status:400}
 const access=await authorizePlayerPracticeScope(service,owner,scope);if(!access.ok)return access
 let query=service.from('internal_schedule_events').select('id,event_type,title,scheduled_date,scheduled_time,facility,status,metadata,created_by_user_id,updated_at').eq('event_type','captain_practice').eq('metadata->>teamName',scope.teamName).eq('metadata->>leagueName',scope.leagueName).eq('metadata->>flight',scope.flight).in('status',['proposed','confirmed','completed','cancelled']).order('scheduled_date',{ascending:false}).order('id').limit(41);if(id)query=query.eq('id',id)
 const result=await query;if(result.error||!Array.isArray(result.data)||result.data.length>41)return {ok:false as const,status:503}
 const rows=result.data.slice(0,40),eventIds=rows.map(r=>r.id);if(!rows.length)return {ok:true as const,status:200,owner,scope,more:false,practices:[] as PlayerPractice[]}
 const own=await service.from('captain_practice_invitees').select('id,event_id,invite_id,profile_id,player_name,note').eq('profile_id',owner).in('event_id',eventIds).limit(81)
 if(own.error||!Array.isArray(own.data)||own.data.length>80||own.data.some(p=>p.profile_id!==owner||!eventIds.includes(p.event_id)))return {ok:false as const,status:503}
 const mine=own.data;if(new Set(mine.map(p=>p.event_id)).size!==mine.length)return {ok:false as const,status:409}
 const ids=mine.map(p=>p.event_id);if(!ids.length)return {ok:true as const,status:200,owner,scope,more:result.data.length>40,practices:[] as PlayerPractice[]}
 const invites=await service.from('captain_practice_invites').select('id,event_id,capacity,created_by_user_id').in('event_id',ids).limit(41)
 if(invites.error||!Array.isArray(invites.data)||invites.data.length!==ids.length||new Set(invites.data.map(p=>p.event_id)).size!==ids.length||invites.data.some(i=>!ids.includes(i.event_id)||i.created_by_user_id!==rows.find(e=>e.id===i.event_id)?.created_by_user_id||(i.capacity!==null&&(!Number.isInteger(i.capacity)||i.capacity<1||i.capacity>100))||!mine.some(p=>p.event_id===i.event_id&&p.invite_id===i.id)))return {ok:false as const,status:503}
 const roster=await service.from('captain_practice_invitees').select('id,event_id,invite_id,response_status,responded_at,captain_confirmed_at,updated_at').in('invite_id',invites.data.map(i=>i.id)).in('event_id',ids).limit(2001)
 if(roster.error||!Array.isArray(roster.data)||roster.data.length>2000||new Set(roster.data.map(p=>p.id)).size!==roster.data.length||roster.data.some(p=>!practiceId(p.id)||!invites.data.some(i=>i.id===p.invite_id&&i.event_id===p.event_id)||!['in','out','maybe','unanswered'].includes(p.response_status)||!practiceStamp(p.updated_at)||(p.responded_at!==null&&!practiceStamp(p.responded_at))||(p.captain_confirmed_at!==null&&!practiceStamp(p.captain_confirmed_at))))return {ok:false as const,status:503}
 const practices:PlayerPractice[]=[]
 for(const e of rows.filter(e=>ids.includes(e.id))){if(!practiceId(e.id)||e.event_type!=='captain_practice'||e.metadata?.teamName!==scope.teamName||e.metadata?.leagueName!==scope.leagueName||e.metadata?.flight!==scope.flight||id&&e.id!==id||!['proposed','confirmed','completed','cancelled'].includes(e.status)||!practiceStamp(e.updated_at)||!str(e.title,300,false)||!/^\d{4}-\d{2}-\d{2}$/.test(e.scheduled_date)||!Number.isFinite(Date.parse(e.scheduled_date))||new Date(e.scheduled_date).toISOString().slice(0,10)!==e.scheduled_date||!str(e.scheduled_time??'',80)||!str(e.facility??'',300)||!str(e.metadata?.practiceNotes??'',3000)||!str(e.metadata?.practiceEndTime??'',80))return {ok:false as const,status:503}
 const inv=invites.data.find(i=>i.event_id===e.id)!,self=mine.find(p=>p.event_id===e.id)!,people=roster.data.filter(p=>p.event_id===e.id);if(people.length>250||(!str(self.note,300)||!str(self.player_name,300,false)))return {ok:false as const,status:503}
 const assigned=assignPracticeDisplayStatuses(people.map(p=>({...p,responseStatus:p.response_status,respondedAt:p.responded_at||'',captainConfirmedAt:p.captain_confirmed_at||''})),inv.capacity),person=assigned.find(p=>p.id===self.id);if(!person)return {ok:false as const,status:503}
 // Names, profile identifiers, phone contacts and bearer tokens from other invitees never leave the server.
 practices.push({id:e.id,title:e.title,date:e.scheduled_date,time:e.scheduled_time||'',endTime:e.metadata?.practiceEndTime||'',facility:e.facility||'',focus:e.metadata?.practiceNotes||'',status:e.status,updatedAt:e.updated_at,capacity:inv.capacity,inCount:assigned.filter(p=>p.displayStatus==='in').length,waitlistCount:assigned.filter(p=>p.displayStatus==='waitlist').length,mine:{id:self.id,name:self.player_name,response:person.response_status,displayStatus:person.displayStatus,note:self.note,confirmedAt:person.captain_confirmed_at,updatedAt:person.updated_at}})
 }
 return {ok:true as const,status:200,owner,scope,more:result.data.length>40,practices}
}
export async function replyToPlayerPractice(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:unknown){
 if(!validPlayerPracticeReply(body))return {ok:false as const,status:400}
 const access=await authorizePlayerPracticeScope(service,owner,scope);if(!access.ok)return access
 const r=await service.rpc('native_reply_practice',{p_owner:owner,p_team:scope.teamName,p_league:scope.leagueName,p_flight:scope.flight,p_event:body.eventId,p_event_revision:body.eventUpdatedAt,p_person:body.personId,p_revision:body.updatedAt,p_response:body.response,p_note:body.note})
 if(r.error||r.data?.ok!==true)return {ok:false as const,status:[400,403,404,409].includes(r.data?.status)?r.data.status:503}
 if(r.data.nativePracticeReply!==1||r.data.eventId!==body.eventId)return {ok:false as const,status:503}
 return loadPlayerPractices(service,owner,scope,body.eventId)
}
